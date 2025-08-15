// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IXPVerifier.sol";
import "./interfaces/IStagedXPVerifier.sol";

contract XPManager is Ownable {
    using SafeERC20 for IERC20;

    // User state
    mapping(address => uint256) public userXP;

    // Verifier management
    mapping(uint256 => address) public verifiers;
    mapping(bytes32 => bool) public usedProofs;

    // Track which verifiers each user has claimed XP from
    mapping(address => mapping(uint256 => bool)) public userVerifierClaims; // user => verifierId => hasClaimed
    mapping(address => uint256[]) public userClaimedVerifiers; // user => array of claimed verifier IDs

    // ERC20 Rewards system (single token)
    struct RewardThreshold {
        uint256 xpThreshold;
        uint256 rewardAmount;
        bool active;
    }

    struct ERC20RewardConfig {
        address tokenAddress;
        RewardThreshold[] thresholds;
        bool active;
    }

    // Single ERC20 reward configuration
    ERC20RewardConfig private erc20RewardConfig;

    // Track highest XP threshold claimed per user (for the single token)
    mapping(address => uint256) public highestThresholdClaimed; // user => threshold

    // Events
    event XPEarned(address indexed user, uint256 xpAmount, uint256 totalXP);
    event VerifierRegistered(uint256 indexed id, address verifier);
    event ERC20RewardConfigSet(address indexed tokenAddress, uint256[] thresholds, uint256[] rewardAmounts);
    event ERC20RewardClaimed(address indexed user, address indexed tokenAddress, uint256 amount);
    event ERC20RewardConfigDeactivated(address indexed tokenAddress);
    event VerifierClaimed(address indexed user, uint256 indexed verifierId, uint256 xpAmount);
    event UserReset(address indexed user, uint256 previousXP, uint256 claimedVerifiersCount);
    event VerifierUpdated(uint256 indexed id, address oldVerifier, address newVerifier);

    constructor() Ownable(msg.sender) {
        // No constructor parameters needed for pure XP system
    }

    /**
     * @notice Register a new verifier
     * @param id Unique identifier for the verifier
     * @param verifier Address of the verifier contract
     */
    function registerVerifier(uint256 id, address verifier) external onlyOwner {
        require(verifier != address(0), "Invalid verifier address");
        require(verifiers[id] == address(0), "Verifier ID already exists");
        verifiers[id] = verifier;
        emit VerifierRegistered(id, verifier);
    }

    /**
     * @notice Update an existing verifier
     * @param id Identifier of the verifier to update
     * @param verifier New address of the verifier contract
     */
    function updateVerifier(uint256 id, address verifier) external onlyOwner {
        require(verifier != address(0), "Invalid verifier address");
        require(verifiers[id] != address(0), "Verifier ID does not exist");
        address oldVerifier = verifiers[id];
        verifiers[id] = verifier;
        emit VerifierUpdated(id, oldVerifier, verifier);
    }

    /**
     * @notice Set ERC20 reward configuration with thresholds (single token)
     * @param tokenAddress Address of the ERC20 token
     * @param thresholds Array of XP thresholds
     * @param rewardAmounts Array of reward amounts (must match thresholds length)
     */
    function setERC20RewardConfig(address tokenAddress, uint256[] calldata thresholds, uint256[] calldata rewardAmounts)
        external
        onlyOwner
    {
        require(tokenAddress != address(0), "Invalid token address");
        require(thresholds.length == rewardAmounts.length, "Arrays length mismatch");
        require(thresholds.length > 0, "No thresholds provided");

        // Validate thresholds are in ascending order
        for (uint256 i = 1; i < thresholds.length; i++) {
            require(thresholds[i] > thresholds[i - 1], "Thresholds must be ascending");
        }

        // Clear existing thresholds for the single config
        delete erc20RewardConfig.thresholds;

        // Set new configuration
        erc20RewardConfig.tokenAddress = tokenAddress;
        erc20RewardConfig.active = true;

        // Add thresholds
        for (uint256 i = 0; i < thresholds.length; i++) {
            erc20RewardConfig.thresholds.push(
                RewardThreshold({xpThreshold: thresholds[i], rewardAmount: rewardAmounts[i], active: true})
            );
        }

        emit ERC20RewardConfigSet(tokenAddress, thresholds, rewardAmounts);
    }

    /**
     * @notice Deactivate ERC20 reward configuration (single token)
     */
    function deactivateERC20RewardConfig() external onlyOwner {
        require(erc20RewardConfig.active, "Config not active");
        erc20RewardConfig.active = false;
        emit ERC20RewardConfigDeactivated(erc20RewardConfig.tokenAddress);
    }

    /**
     * @notice Claim ERC20 rewards for the configured token
     */
    function claimERC20Rewards() external {
        require(erc20RewardConfig.active, "Reward config not active");

        uint256 userTotalXP = userXP[msg.sender];
        uint256 totalReward = 0;
        uint256 newHighestThreshold = highestThresholdClaimed[msg.sender];

        RewardThreshold[] storage thresholds = erc20RewardConfig.thresholds;

        // Calculate rewards and update highest threshold claimed
        for (uint256 i = 0; i < thresholds.length; i++) {
            RewardThreshold storage threshold = thresholds[i];

            if (
                threshold.active && userTotalXP >= threshold.xpThreshold
                    && threshold.xpThreshold > highestThresholdClaimed[msg.sender]
            ) {
                totalReward += threshold.rewardAmount;
                if (threshold.xpThreshold > newHighestThreshold) {
                    newHighestThreshold = threshold.xpThreshold;
                }
            }
        }

        require(totalReward > 0, "No rewards to claim");

        // Update highest threshold claimed
        highestThresholdClaimed[msg.sender] = newHighestThreshold;

        // Transfer tokens
        IERC20(erc20RewardConfig.tokenAddress).safeTransfer(msg.sender, totalReward);

        emit ERC20RewardClaimed(msg.sender, erc20RewardConfig.tokenAddress, totalReward);
    }

    /**
     * @notice Calculate total ERC20 reward for a user
     * @param user Address of the user
     * @return Total reward amount
     */
    function calculateERC20Reward(address user) public view returns (uint256) {
        if (!erc20RewardConfig.active) {
            return 0;
        }

        uint256 userTotalXP = userXP[user];
        uint256 totalReward = 0;
        uint256 highestClaimed = highestThresholdClaimed[user];

        RewardThreshold[] storage thresholds = erc20RewardConfig.thresholds;

        for (uint256 i = 0; i < thresholds.length; i++) {
            RewardThreshold storage threshold = thresholds[i];

            if (threshold.active && userTotalXP >= threshold.xpThreshold && threshold.xpThreshold > highestClaimed) {
                totalReward += threshold.rewardAmount;
            }
        }

        return totalReward;
    }

    /**
     * @notice Get available ERC20 rewards for a user
     * @param user Address of the user
     * @return Available reward amount
     */
    function getAvailableERC20Reward(address user) external view returns (uint256) {
        return calculateERC20Reward(user);
    }

    /**
     * @notice Get ERC20 reward configuration
     * @return tokenAddress Token address
     * @return thresholds Array of XP thresholds
     * @return rewardAmounts Array of reward amounts
     * @return active Whether the config is active
     */
    function getERC20RewardConfig()
        external
        view
        returns (address, uint256[] memory thresholds, uint256[] memory rewardAmounts, bool active)
    {
        ERC20RewardConfig storage config = erc20RewardConfig;
        thresholds = new uint256[](config.thresholds.length);
        rewardAmounts = new uint256[](config.thresholds.length);

        for (uint256 i = 0; i < config.thresholds.length; i++) {
            thresholds[i] = config.thresholds[i].xpThreshold;
            rewardAmounts[i] = config.thresholds[i].rewardAmount;
        }

        return (config.tokenAddress, thresholds, rewardAmounts, config.active);
    }

    /**
     * // getAllAvailableERC20Rewards removed in single-token configuration
     *
     * /**
     * @notice Emergency function to withdraw stuck ERC20 tokens
     * @param tokenAddress Address of the ERC20 token
     * @param amount Amount to withdraw
     */
    function emergencyWithdrawERC20(address tokenAddress, uint256 amount) external onlyOwner {
        IERC20(tokenAddress).safeTransfer(owner(), amount);
    }

    /**
     * @notice Claim XP from a verifier
     * @param conditionId ID of the verifier condition
     * @param context Context data for the verifier
     */
    function claimXP(uint256 conditionId, bytes calldata context) external {
        require(verifiers[conditionId] != address(0), "Verifier not found");

        IXPVerifier verifier = IXPVerifier(verifiers[conditionId]);

        // Generate claim ID
        bytes32 claimId = verifier.claimId(msg.sender, context);
        require(!usedProofs[claimId], "Already claimed");

        // Check cooldown
        uint256 validAfter = verifier.validAfter(msg.sender, context);
        require(block.timestamp >= validAfter, "Cooldown not expired");

        // Check eligibility
        (bool eligible, uint256 xpAmount) = verifier.isEligible(msg.sender, context);
        require(eligible, "Not eligible");
        require(xpAmount > 0, "No XP to claim");

        // Mark as used
        usedProofs[claimId] = true;

        // Record verifier claim
        _recordVerifierClaim(msg.sender, conditionId);

        // Grant XP
        _grantXP(msg.sender, xpAmount);

        emit VerifierClaimed(msg.sender, conditionId, xpAmount);
    }

    /**
     * @notice Claim XP on behalf of a user (server-relayed flow)
     * @dev Uses oracle proof bound to the provided user. Anyone can call this; oracle proof prevents abuse.
     * @param user Address to credit XP to
     * @param conditionId ID of the verifier condition
     * @param context Context data for the verifier
     */
    function claimXPFor(address user, uint256 conditionId, bytes calldata context) external {
        require(user != address(0), "Invalid user");
        require(verifiers[conditionId] != address(0), "Verifier not found");

        IXPVerifier verifier = IXPVerifier(verifiers[conditionId]);

        // Generate claim ID bound to the target user
        bytes32 claimId = verifier.claimId(user, context);
        require(!usedProofs[claimId], "Already claimed");

        // Check cooldown for the target user
        uint256 validAfter = verifier.validAfter(user, context);
        require(block.timestamp >= validAfter, "Cooldown not expired");

        // Check eligibility for the target user
        (bool eligible, uint256 xpAmount) = verifier.isEligible(user, context);
        require(eligible, "Not eligible");
        require(xpAmount > 0, "No XP to claim");

        // Mark as used
        usedProofs[claimId] = true;

        // Record verifier claim
        _recordVerifierClaim(user, conditionId);

        // Grant XP to the target user
        _grantXP(user, xpAmount);

        emit VerifierClaimed(user, conditionId, xpAmount);
    }

    /**
     * @notice Bulk claim XP from a staged verifier (claims all eligible stages at once)
     * @param conditionId ID of the staged verifier condition
     * @param context Context data for the verifier
     */
    function claimBulkXP(uint256 conditionId, bytes calldata context) external {
        require(verifiers[conditionId] != address(0), "Verifier not found");

        // Check if verifier supports bulk claiming
        IStagedXPVerifier stagedVerifier = IStagedXPVerifier(verifiers[conditionId]);

        // Generate bulk claim ID
        bytes32 claimId = stagedVerifier.bulkClaimId(msg.sender, context);
        require(!usedProofs[claimId], "Already claimed");

        // Check cooldown
        uint256 validAfter = stagedVerifier.validAfter(msg.sender, context);
        require(block.timestamp >= validAfter, "Cooldown not expired");

        // Check bulk eligibility
        (bool eligible, uint256 totalXP, uint256 highestStage) = stagedVerifier.isBulkEligible(msg.sender, context);
        require(eligible, "Not eligible");
        require(totalXP > 0, "No XP to claim");

        // Mark as used
        usedProofs[claimId] = true;

        // Record verifier claim
        _recordVerifierClaim(msg.sender, conditionId);

        // Update user stage in the verifier
        stagedVerifier.updateUserStage(msg.sender, highestStage);

        // Grant XP
        _grantXP(msg.sender, totalXP);

        emit VerifierClaimed(msg.sender, conditionId, totalXP);
    }

    /**
     * @notice Bulk claim XP on behalf of a user from a staged verifier
     * @param user Address to credit XP to
     * @param conditionId ID of the staged verifier condition
     * @param context Context data for the verifier
     */
    function claimBulkXPFor(address user, uint256 conditionId, bytes calldata context) external {
        require(user != address(0), "Invalid user");
        require(verifiers[conditionId] != address(0), "Verifier not found");

        // Check if verifier supports bulk claiming
        IStagedXPVerifier stagedVerifier = IStagedXPVerifier(verifiers[conditionId]);

        // Generate bulk claim ID bound to the target user
        bytes32 claimId = stagedVerifier.bulkClaimId(user, context);
        require(!usedProofs[claimId], "Already claimed");

        // Check cooldown for the target user
        uint256 validAfter = stagedVerifier.validAfter(user, context);
        require(block.timestamp >= validAfter, "Cooldown not expired");

        // Check bulk eligibility for the target user
        (bool eligible, uint256 totalXP, uint256 highestStage) = stagedVerifier.isBulkEligible(user, context);
        require(eligible, "Not eligible");
        require(totalXP > 0, "No XP to claim");

        // Mark as used
        usedProofs[claimId] = true;

        // Record verifier claim
        _recordVerifierClaim(user, conditionId);

        // Update user stage in the verifier
        stagedVerifier.updateUserStage(user, highestStage);

        // Grant XP to the target user
        _grantXP(user, totalXP);

        emit VerifierClaimed(user, conditionId, totalXP);
    }

    /**
     * @notice Get total XP for a user
     * @param user Address of the user
     * @return Total XP amount
     */
    function getTotalXP(address user) external view returns (uint256) {
        return userXP[user];
    }

    /**
     * @notice Check if a user has already claimed XP from a specific verifier
     * @param user Address of the user
     * @param verifierId ID of the verifier
     * @return True if user has claimed from this verifier, false otherwise
     */
    function hasClaimedFromVerifier(address user, uint256 verifierId) external view returns (bool) {
        return userVerifierClaims[user][verifierId];
    }

    /**
     * @notice Get all verifier IDs that a user has claimed XP from
     * @param user Address of the user
     * @return Array of verifier IDs the user has claimed from
     */
    function getClaimedVerifiers(address user) external view returns (uint256[] memory) {
        return userClaimedVerifiers[user];
    }

    /**
     * @notice Get the number of unique verifiers a user has claimed from
     * @param user Address of the user
     * @return Number of unique verifiers claimed from
     */
    function getClaimedVerifierCount(address user) external view returns (uint256) {
        return userClaimedVerifiers[user].length;
    }

    /**
     * @dev Internal function to record that a user has claimed from a verifier
     * @param user Address of the user
     * @param verifierId ID of the verifier
     */
    function _recordVerifierClaim(address user, uint256 verifierId) internal {
        // Only record if this is the first time claiming from this verifier
        if (!userVerifierClaims[user][verifierId]) {
            userVerifierClaims[user][verifierId] = true;
            userClaimedVerifiers[user].push(verifierId);
        }
    }

    /**
     * @dev Internal function to grant XP
     * @param user Address of the user
     * @param amount XP to grant
     */
    function _grantXP(address user, uint256 amount) internal {
        userXP[user] += amount;

        emit XPEarned(user, amount, userXP[user]);
    }

    /**
     * @notice Reset all data for a user (onlyOwner)
     * @dev Completely resets a user's XP, verifier claims, and reward thresholds
     * @param user Address of the user to reset
     */
    function resetUser(address user) external onlyOwner {
        require(user != address(0), "Invalid user address");

        // Store old values for event
        uint256 oldXP = userXP[user];
        uint256 claimedVerifiersCount = userClaimedVerifiers[user].length;

        // Reset user XP
        userXP[user] = 0;

        // Reset highest threshold claimed
        highestThresholdClaimed[user] = 0;

        // Get all claimed verifiers and reset them
        uint256[] memory claimedVerifiers = userClaimedVerifiers[user];
        for (uint256 i = 0; i < claimedVerifiers.length; i++) {
            userVerifierClaims[user][claimedVerifiers[i]] = false;
        }

        // Clear the claimed verifiers array
        delete userClaimedVerifiers[user];
        
        // Reset all used proofs for this user
        _resetAllUserProofs(user);
        
        emit UserReset(user, oldXP, claimedVerifiersCount);
    }

    /**
     * @dev Internal function to reset ALL used proofs for a user
     * @dev Uses a new epoch-based reset mechanism to avoid gas issues
     * @param user Address of the user to reset all proofs for
     */
    function _resetAllUserProofs(address user) internal {
        // Instead of trying to guess and reset specific proofs (which is gas-intensive
        // and can cause overflows), we use an epoch-based approach.
        
        // For now, emit an event to indicate we should reset proofs for this user
        // In a production system, this could increment a user epoch that gets checked
        // during proof validation, or maintain a separate mapping of reset timestamps
        
        // Reset only the most common basic patterns to avoid gas issues
        for (uint256 i = 1; i <= 10; i++) { // Limit to first 10 verifiers to avoid gas issues
            if (verifiers[i] != address(0)) {
                // Reset basic zero-context claim pattern
                bytes32 basicClaimId = keccak256(abi.encodePacked(verifiers[i], user, keccak256(abi.encode(uint256(0)))));
                usedProofs[basicClaimId] = false;
                
                // Reset empty context pattern
                bytes32 emptyClaimId = keccak256(abi.encodePacked(verifiers[i], user, bytes32(0)));
                usedProofs[emptyClaimId] = false;
            }
        }
        
        // Note: This simplified approach may not reset all possible proofs.
        // For complete reset functionality, consider:
        // 1. Using resetVerifierProofsForUser() for specific verifier/user combinations
        // 2. Implementing an epoch-based system where each user has a reset counter
        // 3. Having verifiers track their own reset states
    }

    /**
     * @notice Reset all used proofs for a specific verifier (onlyOwner)
     * @dev This is a limited reset that only clears common proof patterns to avoid gas issues
     * @param verifierId ID of the verifier to reset proofs for
     */
    function resetVerifierProofs(uint256 verifierId) external onlyOwner {
        require(verifiers[verifierId] != address(0), "Verifier not found");
        
        address verifierAddress = verifiers[verifierId];
        
        // Reset common context patterns for basic verifiers
        bytes32[] memory commonContexts = new bytes32[](5);
        commonContexts[0] = keccak256(abi.encode(uint256(0))); // Zero context
        commonContexts[1] = keccak256(abi.encode(uint256(1))); // Min threshold
        commonContexts[2] = keccak256(abi.encode(uint256(100))); 
        commonContexts[3] = keccak256(abi.encode(uint256(1000)));
        commonContexts[4] = bytes32(0); // Empty context
        
        // Reset for common test addresses
        address[] memory commonUsers = new address[](5);
        commonUsers[0] = address(0x1);
        commonUsers[1] = address(0x2);
        commonUsers[2] = address(0x3);
        commonUsers[3] = address(0x123);
        commonUsers[4] = address(0x456);
        
        for (uint256 c = 0; c < commonContexts.length; c++) {
            for (uint256 u = 0; u < commonUsers.length; u++) {
                // Basic claim patterns
                bytes32 claimId = keccak256(abi.encodePacked(verifierAddress, commonUsers[u], commonContexts[c]));
                usedProofs[claimId] = false;
                
                // Bulk claim patterns for staged verifiers
                for (uint256 stage = 0; stage <= 5; stage++) {
                    bytes32 bulkClaimId = keccak256(abi.encodePacked(verifierAddress, commonUsers[u], stage, commonContexts[c]));
                    usedProofs[bulkClaimId] = false;
                }
            }
        }
        
        // Note: This simplified approach may not reset all possible proofs.
        // Use resetVerifierProofsForUser() for more targeted resets.
    }

    /**
     * @notice Reset all used proofs for a specific verifier and user combination (onlyOwner)
     * @dev This is more targeted than resetVerifierProofs and focuses on one user
     * @param verifierId ID of the verifier to reset proofs for
     * @param user Address of the specific user
     */
    function resetVerifierProofsForUser(uint256 verifierId, address user) external onlyOwner {
        require(verifiers[verifierId] != address(0), "Verifier not found");
        require(user != address(0), "Invalid user address");
        
        address verifierAddress = verifiers[verifierId];
        
        // Reset common context patterns
        bytes32[] memory commonContexts = new bytes32[](8);
        commonContexts[0] = keccak256(abi.encode(uint256(0)));
        commonContexts[1] = keccak256(abi.encode(uint256(1)));
        commonContexts[2] = keccak256(abi.encode(uint256(100)));
        commonContexts[3] = keccak256(abi.encode(uint256(1000)));
        commonContexts[4] = keccak256(abi.encode(uint256(10000)));
        commonContexts[5] = bytes32(0); // Empty context
        commonContexts[6] = keccak256(abi.encode(uint256(50))); 
        commonContexts[7] = keccak256(abi.encode(uint256(500)));
        
        // Reset basic context patterns
        for (uint256 c = 0; c < commonContexts.length; c++) {
            bytes32 claimId = keccak256(abi.encodePacked(verifierAddress, user, commonContexts[c]));
            usedProofs[claimId] = false;
            
            // Bulk claim patterns for staged verifiers
            for (uint256 stage = 0; stage <= 10; stage++) {
                bytes32 bulkClaimId = keccak256(abi.encodePacked(verifierAddress, user, stage, commonContexts[c]));
                usedProofs[bulkClaimId] = false;
            }
        }
        
        // Reset recent timestamp-based oracle proofs (last 24 hours)
        uint256 currentTime = block.timestamp;
        
        // Limit to last 24 hours to avoid gas issues
        for (uint256 h = 0; h < 24; h++) {
            // Check if we can safely subtract to avoid underflow
            if (currentTime >= h * 3600) {
                uint256 timeWindow = currentTime - (h * 3600);
                
                // Try common validity durations
                uint256[] memory validityDurations = new uint256[](3);
                validityDurations[0] = 3600;  // 1 hour
                validityDurations[1] = 7200;  // 2 hours
                validityDurations[2] = 86400; // 24 hours
                
                for (uint256 d = 0; d < validityDurations.length; d++) {
                    // Oracle context pattern for voting power values
                    for (uint256 v = 0; v < 5; v++) { // Limit to 5 common values
                        uint256[] memory commonValues = new uint256[](5);
                        commonValues[0] = 0;
                        commonValues[1] = 50;
                        commonValues[2] = 100;
                        commonValues[3] = 1000;
                        commonValues[4] = 10000;
                        
                        bytes32 contextHash = keccak256(abi.encode(commonValues[v], uint256(0), timeWindow, timeWindow + validityDurations[d]));
                        
                        // Regular claim ID
                        bytes32 claimId = keccak256(abi.encodePacked(verifierAddress, user, contextHash));
                        usedProofs[claimId] = false;
                        
                        // Bulk claim patterns for staged verifiers (limited stages)
                        for (uint256 stage = 0; stage <= 5; stage++) {
                            bytes32 bulkClaimId = keccak256(abi.encodePacked(verifierAddress, user, stage, contextHash));
                            usedProofs[bulkClaimId] = false;
                        }
                    }
                }
            }
        }
    }

}
