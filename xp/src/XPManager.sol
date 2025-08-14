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

        // Note: usedProofs cannot be easily reset without knowing the specific claimIds
        // This would require additional tracking or manual intervention for each proof

        emit UserReset(user, oldXP, claimedVerifiersCount);
    }
}
