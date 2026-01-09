// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {MoonDAOTeam} from "../src/ERC5643.sol";
import {Whitelist} from "../src/Whitelist.sol";

contract ExtendTeamSubsScript is Script {
    address constant TEAM_CONTRACT = 0x21d2C4bEBd1AEb830277F8548Ae30F505551f961;
    address constant DISCOUNT_LIST_CONTRACT = 0x755D48e6C3744B723bd0326C57F99A92a3Ca3287;
    address constant MULTISIG_ADDRESS = 0xB39d2874908F64dB33adde8b4739a9bFe83F9cFC;
    
    // Duration for subscription renewal (1 year in seconds)
    uint64 constant ONE_YEAR = 365 days;
    
    uint256[] BLOCKED_TEAMS;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        // Get contract instances
        MoonDAOTeam teamContract = MoonDAOTeam(TEAM_CONTRACT);
        Whitelist discountList = Whitelist(DISCOUNT_LIST_CONTRACT);
        
        console.log("Starting team subscription extension process...");
        if (BLOCKED_TEAMS.length > 0) {
            console.log("Blocked teams (will be excluded):");
            for (uint256 i = 0; i < BLOCKED_TEAMS.length; i++) {
                console.log("  - Team %d", BLOCKED_TEAMS[i]);
            }
        } else {
            console.log("No blocked teams");
        }
        
        // Step 1: Get all valid team token IDs (excluding blocked teams)
        uint256[] memory validTokenIds = getAllValidTeamTokenIds(teamContract);
        console.log("Found %d valid team tokens (excluding blocked teams)", validTokenIds.length);
        
        if (validTokenIds.length == 0) {
            console.log("No valid team tokens found. Exiting.");
            vm.stopBroadcast();
            return;
        }
        
        // Step 2: Add every valid team to the discount list
        addTeamsToDiscountList(teamContract, discountList, validTokenIds);
        console.log("Added all teams to discount list");
        
        // Step 3: Renew subscriptions for all valid teams
        renewAllTeamSubscriptions(teamContract, validTokenIds);
        console.log("Renewed subscriptions for all teams");
        
        // Step 4: Verify subscription extensions
        verifySubscriptionExtensions(teamContract, validTokenIds);
        console.log("Verified subscription extensions");
        
        // Step 5: Remove all teams from discount list
        removeTeamsFromDiscountList(teamContract, discountList, validTokenIds);
        console.log("Removed all teams from discount list");
        
        // Step 6: Transfer ownership back to multisig
        transferOwnershipToMultisig(discountList);
        console.log("Transferred ownership back to multisig");
        
        console.log("Team subscription extension process completed successfully!");
        
        vm.stopBroadcast();
    }
    
    /**
     * @dev Check if a token ID is in the blocked teams list
     * @param tokenId The token ID to check
     * @return isBlocked True if the token is blocked
     */
    function isTokenBlocked(uint256 tokenId) internal view returns (bool) {
        for (uint256 i = 0; i < BLOCKED_TEAMS.length; i++) {
            if (BLOCKED_TEAMS[i] == tokenId) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Get all valid team token IDs by iterating through all possible token IDs
     * @param teamContract The MoonDAOTeam contract instance
     * @return validTokenIds Array of valid token IDs (excluding blocked teams)
     */
    function getAllValidTeamTokenIds(MoonDAOTeam teamContract) internal view returns (uint256[] memory) {
        uint256 maxTokens = 150; // Adjust this based on your expected token count
        uint256[] memory tempTokenIds = new uint256[](maxTokens);
        uint256 validCount = 0;
        
        for (uint256 i = 1; i <= maxTokens; i++) {
            // Skip blocked teams
            if (isTokenBlocked(i)) {
                console.log("Skipping blocked team token %d", i);
                continue;
            }
            
            try teamContract.ownerOf(i) returns (address owner) {
                if (owner != address(0)) {
                    tempTokenIds[validCount] = i;
                    validCount++;
                }
            } catch {
                // Token doesn't exist, continue
                continue;
            }
        }
        
        // Create final array with correct size
        uint256[] memory validTokenIds = new uint256[](validCount);
        for (uint256 i = 0; i < validCount; i++) {
            validTokenIds[i] = tempTokenIds[i];
        }
        
        return validTokenIds;
    }
    
    /**
     * @dev Add all valid teams to the discount list
     * @param teamContract The MoonDAOTeam contract instance
     * @param discountList The Whitelist contract for discounts
     * @param tokenIds Array of token IDs to process
     */
    function addTeamsToDiscountList(
        MoonDAOTeam teamContract, 
        Whitelist discountList, 
        uint256[] memory tokenIds
    ) internal {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            address owner = teamContract.ownerOf(tokenIds[i]);
            discountList.addToWhitelist(owner);
            console.log("Added token %d owner %s to discount list", tokenIds[i], owner);
        }
    }
    
    /**
     * @dev Renew subscriptions for all valid teams
     * @param teamContract The MoonDAOTeam contract instance
     * @param tokenIds Array of token IDs to process
     */
    function renewAllTeamSubscriptions(
        MoonDAOTeam teamContract, 
        uint256[] memory tokenIds
    ) internal {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            // Get the owner for this token (needed for both price calculation and renewal)
            address owner = teamContract.ownerOf(tokenIds[i]);
            
            // Get the renewal price for this token
            uint256 renewalPrice = teamContract.getRenewalPrice(owner, ONE_YEAR);
            
            // Renew the subscription with the calculated price
            // Note: renewSubscription for teams takes (address sender, uint256 tokenId, uint64 duration)
            teamContract.renewSubscription{value: renewalPrice}(owner, tokenIds[i], ONE_YEAR);
            console.log("Renewed subscription for token %d with price %d wei", tokenIds[i], renewalPrice);
        }
    }
    
    /**
     * @dev Verify that all subscriptions were extended correctly
     * @param teamContract The MoonDAOTeam contract instance
     * @param tokenIds Array of token IDs to verify
     */
    function verifySubscriptionExtensions(
        MoonDAOTeam teamContract, 
        uint256[] memory tokenIds
    ) internal view {
        uint64 currentTime = uint64(block.timestamp);
        uint64 expectedExpiration = currentTime + ONE_YEAR;
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint64 expiration = teamContract.expiresAt(tokenIds[i]);
            console.log("Token %d expires at %d (expected around %d)", tokenIds[i], expiration, expectedExpiration);
            
            if (expiration < currentTime) {
                console.log("WARNING: Token %d subscription has expired!", tokenIds[i]);
            } else if (expiration < expectedExpiration - 1 days) {
                console.log("WARNING: Token %d subscription may not have been renewed properly", tokenIds[i]);
            } else {
                console.log("Token %d subscription verified successfully", tokenIds[i]);
            }
        }
    }
    
    /**
     * @dev Remove all teams from the discount list
     * @param teamContract The MoonDAOTeam contract instance
     * @param discountList The Whitelist contract for discounts
     * @param tokenIds Array of token IDs to process
     */
    function removeTeamsFromDiscountList(
        MoonDAOTeam teamContract, 
        Whitelist discountList, 
        uint256[] memory tokenIds
    ) internal {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            address owner = teamContract.ownerOf(tokenIds[i]);
            discountList.removeFromWhitelist(owner);
            console.log("Removed token %d owner %s from discount list", tokenIds[i], owner);
        }
    }
    
    /**
     * @dev Transfer ownership of discount list back to multisig
     * @param discountList The Whitelist contract for discounts
     */
    function transferOwnershipToMultisig(
        Whitelist discountList
    ) internal {
        // Transfer ownership of discount list
        discountList.transferOwnership(MULTISIG_ADDRESS);
        console.log("Transferred discount list contract ownership to multisig");
    }
}

