// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ERC5643Citizen.sol";
import "../src/Whitelist.sol";

contract ExtendCitizenSubsScript is Script {
    address constant CITIZEN_CONTRACT = 0x6E464F19e0fEF3DB0f3eF9FD3DA91A297DbFE002;
    address constant DISCOUNT_LIST_CONTRACT = 0x755D48e6C3744B723bd0326C57F99A92a3Ca3287;
    address constant MULTISIG_ADDRESS = 0x29B0D7d7f0C88Ce0DF1De5888b37B90A6faF75cB;
    
    // Duration for subscription renewal (1 year in seconds)
    uint64 constant ONE_YEAR = 365 days;
    
    uint256[] constant BLOCKED_CITIZENS = [48, 72, 140];
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        // Get contract instances
        ERC5643Citizen citizenContract = ERC5643Citizen(CITIZEN_CONTRACT);
        Whitelist discountList = Whitelist(DISCOUNT_LIST_CONTRACT);
        
        console.log("Starting citizen subscription extension process...");
        console.log("Blocked citizens (will be excluded): %s", vm.toString(BLOCKED_CITIZENS));
        
        // Step 1: Get all valid citizen token IDs (excluding blocked citizens)
        uint256[] memory validTokenIds = getAllValidCitizenTokenIds(citizenContract);
        console.log("Found %d valid citizen tokens (excluding blocked citizens)", validTokenIds.length);
        
        if (validTokenIds.length == 0) {
            console.log("No valid citizen tokens found. Exiting.");
            vm.stopBroadcast();
            return;
        }
        
        // Step 2: Add every valid citizen to the discount list
        addCitizensToDiscountList(citizenContract, discountList, validTokenIds);
        console.log("Added all citizens to discount list");
        
        // Step 3: Renew subscriptions for all valid citizens
        renewAllCitizenSubscriptions(citizenContract, validTokenIds);
        console.log("Renewed subscriptions for all citizens");
        
        // Step 4: Verify subscription extensions
        verifySubscriptionExtensions(citizenContract, validTokenIds);
        console.log("Verified subscription extensions");
        
        // Step 5: Remove all citizens from discount list
        removeCitizensFromDiscountList(citizenContract, discountList, validTokenIds);
        console.log("Removed all citizens from discount list");
        
        // Step 6: Transfer ownership back to multisig
        transferOwnershipToMultisig(discountList);
        console.log("Transferred ownership back to multisig");
        
        console.log("Citizen subscription extension process completed successfully!");
        
        vm.stopBroadcast();
    }
    
    /**
     * @dev Check if a token ID is in the blocked citizens list
     * @param tokenId The token ID to check
     * @return isBlocked True if the token is blocked
     */
    function isTokenBlocked(uint256 tokenId) internal pure returns (bool) {
        for (uint256 i = 0; i < BLOCKED_CITIZENS.length; i++) {
            if (BLOCKED_CITIZENS[i] == tokenId) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Get all valid citizen token IDs by iterating through all possible token IDs
     * @param citizenContract The ERC5643Citizen contract instance
     * @return validTokenIds Array of valid token IDs (excluding blocked citizens)
     */
    function getAllValidCitizenTokenIds(ERC5643Citizen citizenContract) internal view returns (uint256[] memory) {
        uint256 maxTokens = 150; // Adjust this based on your expected token count
        uint256[] memory tempTokenIds = new uint256[](maxTokens);
        uint256 validCount = 0;
        
        for (uint256 i = 1; i <= maxTokens; i++) {
            // Skip blocked citizens
            if (isTokenBlocked(i)) {
                console.log("Skipping blocked citizen token %d", i);
                continue;
            }
            
            try citizenContract.ownerOf(i) returns (address owner) {
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
     * @dev Add all valid citizens to the discount list
     * @param citizenContract The ERC5643Citizen contract instance
     * @param discountList The Whitelist contract for discounts
     * @param tokenIds Array of token IDs to process
     */
    function addCitizensToDiscountList(
        ERC5643Citizen citizenContract, 
        Whitelist discountList, 
        uint256[] memory tokenIds
    ) internal {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            address owner = citizenContract.ownerOf(tokenIds[i]);
            discountList.addToWhitelist(owner);
            console.log("Added token %d owner %s to discount list", tokenIds[i], owner);
        }
    }
    
    /**
     * @dev Renew subscriptions for all valid citizens
     * @param citizenContract The ERC5643Citizen contract instance
     * @param tokenIds Array of token IDs to process
     */
    function renewAllCitizenSubscriptions(
        ERC5643Citizen citizenContract, 
        uint256[] memory tokenIds
    ) internal {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            // Get the renewal price for this token
            address owner = citizenContract.ownerOf(tokenIds[i]);
            uint256 renewalPrice = citizenContract.getRenewalPrice(owner, ONE_YEAR);
            
            // Renew the subscription with the calculated price
            citizenContract.renewSubscription{value: renewalPrice}(tokenIds[i], ONE_YEAR);
            console.log("Renewed subscription for token %d with price %d wei", tokenIds[i], renewalPrice);
        }
    }
    
    /**
     * @dev Verify that all subscriptions were extended correctly
     * @param citizenContract The ERC5643Citizen contract instance
     * @param tokenIds Array of token IDs to verify
     */
    function verifySubscriptionExtensions(
        ERC5643Citizen citizenContract, 
        uint256[] memory tokenIds
    ) internal view {
        uint64 currentTime = uint64(block.timestamp);
        uint64 expectedExpiration = currentTime + ONE_YEAR;
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint64 expiration = citizenContract.expiresAt(tokenIds[i]);
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
     * @dev Remove all citizens from the discount list
     * @param citizenContract The ERC5643Citizen contract instance
     * @param discountList The Whitelist contract for discounts
     * @param tokenIds Array of token IDs to process
     */
    function removeCitizensFromDiscountList(
        ERC5643Citizen citizenContract, 
        Whitelist discountList, 
        uint256[] memory tokenIds
    ) internal {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            address owner = citizenContract.ownerOf(tokenIds[i]);
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
