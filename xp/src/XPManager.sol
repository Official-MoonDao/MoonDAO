// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IXPVerifier.sol";
import "./interfaces/IStagedXPVerifier.sol";
import "./interfaces/IERC5643Like.sol";

contract XPManager is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // User state
    mapping(address => uint256) public userXP;

    // Verifier management
    mapping(uint256 => address) public verifiers;
    mapping(bytes32 => bool) public usedProofs;

    // Track which verifiers each user has claimed XP from
    mapping(address => mapping(uint256 => bool)) public userVerifierClaims; // user => verifierId => hasClaimed
    mapping(address => uint256[]) public userClaimedVerifiers; // user => array of claimed verifier IDs

    // ERC20 Rewards system - direct conversion rate
    struct ERC20RewardConfig {
        address tokenAddress;
        uint256 conversionRate; // How many ERC20 tokens per 1 XP (with decimals)
        bool active;
    }

    // XP Level system
    struct XPLevel {
        uint256 xpThreshold;
        uint256 level;
        bool active;
    }

    // Single ERC20 reward configuration
    ERC20RewardConfig private erc20RewardConfig;

    // XP Levels configuration
    XPLevel[] private xpLevels;

    // Track claimed ERC20 rewards per user
    mapping(address => uint256) public claimedERC20Rewards; // user => total claimed amount

    // Citizen NFT contract for citizenship verification
    IERC5643Like public citizenNFT;

    // Events
    event XPEarned(address indexed user, uint256 xpAmount, uint256 totalXP);
    event VerifierRegistered(uint256 indexed id, address verifier);
    event ERC20RewardConfigSet(address indexed tokenAddress, uint256 conversionRate);
    event ERC20RewardClaimed(address indexed user, address indexed tokenAddress, uint256 amount);
    event ERC20RewardConfigDeactivated(address indexed tokenAddress);
    event VerifierClaimed(address indexed user, uint256 indexed verifierId, uint256 xpAmount);
    event UserReset(address indexed user, uint256 previousXP, uint256 claimedVerifiersCount);
    event VerifierUpdated(uint256 indexed id, address oldVerifier, address newVerifier);
    event XPLevelsSet(uint256[] thresholds, uint256[] levels);
    event LevelUp(address indexed user, uint256 newLevel, uint256 totalXP);
    event CitizenNFTAddressSet(address indexed oldAddress, address indexed newAddress);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        _transferOwnership(msg.sender);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

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
     * @notice Set ERC20 reward configuration with conversion rate
     * @param tokenAddress Address of the ERC20 token
     * @param conversionRate How many ERC20 tokens per 1 XP (with decimals)
     */
    function setERC20RewardConfig(address tokenAddress, uint256 conversionRate) external onlyOwner {
        require(tokenAddress != address(0), "Invalid token address");
        require(conversionRate > 0, "Conversion rate must be greater than 0");

        erc20RewardConfig.tokenAddress = tokenAddress;
        erc20RewardConfig.conversionRate = conversionRate;
        erc20RewardConfig.active = true;

        emit ERC20RewardConfigSet(tokenAddress, conversionRate);
    }

    /**
     * @notice Deactivate ERC20 reward configuration
     */
    function deactivateERC20RewardConfig() external onlyOwner {
        require(erc20RewardConfig.active, "Config not active");
        erc20RewardConfig.active = false;
        emit ERC20RewardConfigDeactivated(erc20RewardConfig.tokenAddress);
    }

    /**
     * @notice Set the citizen NFT contract address for citizenship verification
     * @param citizenNFTAddress Address of the citizen NFT contract
     */
    function setCitizenNFTAddress(address citizenNFTAddress) external onlyOwner {
        require(citizenNFTAddress != address(0), "Invalid citizen NFT address");
        address oldAddress = address(citizenNFT);
        citizenNFT = IERC5643Like(citizenNFTAddress);
        emit CitizenNFTAddressSet(oldAddress, citizenNFTAddress);
    }

    /**
     * @notice Set XP levels configuration
     * @param thresholds Array of XP thresholds for each level
     * @param levels Array of level numbers (must match thresholds length)
     */
    function setXPLevels(uint256[] calldata thresholds, uint256[] calldata levels) external onlyOwner {
        require(thresholds.length == levels.length, "Arrays length mismatch");
        require(thresholds.length > 0, "No levels provided");

        // Validate thresholds are in ascending order
        for (uint256 i = 1; i < thresholds.length; i++) {
            require(thresholds[i] > thresholds[i - 1], "Thresholds must be ascending");
        }

        // Clear existing levels
        delete xpLevels;

        // Add new levels
        for (uint256 i = 0; i < thresholds.length; i++) {
            xpLevels.push(XPLevel({xpThreshold: thresholds[i], level: levels[i], active: true}));
        }

        emit XPLevelsSet(thresholds, levels);
    }

    /**
     * @notice Get XP levels configuration
     * @return thresholds Array of XP thresholds
     * @return levels Array of level numbers
     * @return active Whether levels are configured
     */
    function getXPLevels() external view returns (uint256[] memory thresholds, uint256[] memory levels, bool active) {
        if (xpLevels.length == 0) {
            return (new uint256[](0), new uint256[](0), false);
        }

        thresholds = new uint256[](xpLevels.length);
        levels = new uint256[](xpLevels.length);

        for (uint256 i = 0; i < xpLevels.length; i++) {
            thresholds[i] = xpLevels[i].xpThreshold;
            levels[i] = xpLevels[i].level;
        }

        return (thresholds, levels, true);
    }

    /**
     * @notice Get current level for a user based on their XP
     * @param user Address of the user
     * @return Current level (0 if no levels configured or user has no XP)
     */
    function getUserLevel(address user) external view returns (uint256) {
        return _getUserLevelInternal(user);
    }

    /**
     * @notice Get level information for a specific XP amount
     * @param xpAmount Amount of XP to check
     * @return Level for the given XP amount (0 if no levels configured)
     */
    function getLevelForXP(uint256 xpAmount) external view returns (uint256) {
        if (xpLevels.length == 0) {
            return 0;
        }

        uint256 level = 0;

        // Find the highest level for the given XP amount
        for (uint256 i = 0; i < xpLevels.length; i++) {
            if (xpLevels[i].active && xpAmount >= xpLevels[i].xpThreshold) {
                level = xpLevels[i].level;
            } else {
                break; // Thresholds are in ascending order, so we can break here
            }
        }

        return level;
    }

    /**
     * @notice Get next level information for a user
     * @param user Address of the user
     * @return nextLevel Next level number (0 if no next level)
     * @return xpRequired XP required to reach next level (0 if no next level)
     * @return xpProgress Current XP progress toward next level
     */
    function getNextLevelInfo(address user) external view returns (uint256 nextLevel, uint256 xpRequired, uint256 xpProgress) {
        if (xpLevels.length == 0) {
            return (0, 0, 0);
        }

        uint256 userTotalXP = userXP[user];
        uint256 currentLevel = 0;

        // Find current level and next level
        for (uint256 i = 0; i < xpLevels.length; i++) {
            if (xpLevels[i].active && userTotalXP >= xpLevels[i].xpThreshold) {
                currentLevel = xpLevels[i].level;
            } else {
                // This is the next level
                nextLevel = xpLevels[i].level;
                xpRequired = xpLevels[i].xpThreshold;
                xpProgress = userTotalXP;
                return (nextLevel, xpRequired, xpProgress);
            }
        }

        // User is at max level
        return (0, 0, 0);
    }

    /**
     * @notice Get all level information for display purposes
     * @return thresholds Array of XP thresholds for each level
     * @return levels Array of level numbers
     * @return userLevel Current user level
     * @return currentUserXP User's current XP
     * @return nextLevel Next level number
     * @return xpRequired XP required to reach next level
     * @return xpProgress Current XP progress toward next level
     */
    function getAllLevelInfo(address user) external view returns (
        uint256[] memory thresholds,
        uint256[] memory levels,
        uint256 userLevel,
        uint256 currentUserXP,
        uint256 nextLevel,
        uint256 xpRequired,
        uint256 xpProgress
    ) {
        (thresholds, levels, ) = this.getXPLevels();
        userLevel = this.getUserLevel(user);
        currentUserXP = userXP[user];
        (nextLevel, xpRequired, xpProgress) = this.getNextLevelInfo(user);
        
        return (thresholds, levels, userLevel, currentUserXP, nextLevel, xpRequired, xpProgress);
    }

    /**
     * @notice Calculate available ERC20 rewards for a user based on their XP
     * @param user Address of the user
     * @return Available reward amount
     */
    function calculateAvailableERC20Reward(address user) public view returns (uint256) {
        if (!erc20RewardConfig.active) {
            return 0;
        }

        uint256 totalEarned = (userXP[user] * erc20RewardConfig.conversionRate);
        uint256 alreadyClaimed = claimedERC20Rewards[user];
        
        if (totalEarned > alreadyClaimed) {
            return totalEarned - alreadyClaimed;
        }
        return 0;
    }


    /**
     * @notice Get ERC20 reward configuration
     * @return tokenAddress Token address
     * @return conversionRate Conversion rate (ERC20 tokens per 1 XP)
     * @return active Whether the config is active
     */
    function getERC20RewardConfig() external view returns (address tokenAddress, uint256 conversionRate, bool active) {
        return (erc20RewardConfig.tokenAddress, erc20RewardConfig.conversionRate, erc20RewardConfig.active);
    }

    /**
     * @notice Emergency function to withdraw stuck ERC20 tokens
     * @param tokenAddress Address of the ERC20 token
     * @param amount Amount to withdraw
     */
    function emergencyWithdrawERC20(address tokenAddress, uint256 amount) external onlyOwner {
        IERC20(tokenAddress).safeTransfer(owner(), amount);
    }

    /**
     * @notice Claim XP on behalf of a user and automatically claim ERC20 rewards
     * @dev Uses oracle proof bound to the provided user. Anyone can call this; oracle proof prevents abuse.
     * @param user Address to credit XP to
     * @param conditionId ID of the verifier condition
     * @param context Context data for the verifier
     */
    function claimXPFor(address user, uint256 conditionId, bytes calldata context) external {
        _claimXPInternal(user, conditionId, context);
    }

    /**
     * @notice Claim XP from a verifier and automatically claim ERC20 rewards
     * @param conditionId ID of the verifier condition
     * @param context Context data for the verifier
     */
    function claimXP(uint256 conditionId, bytes calldata context) external {
        _claimXPInternal(msg.sender, conditionId, context);
    }

    /**
     * @notice Check if a user is a citizen (owns at least one citizen NFT)
     * @param user Address to check
     * @return True if user is a citizen, false otherwise
     */
    function isCitizen(address user) public view returns (bool) {
        if (address(citizenNFT) == address(0)) {
            return false; // No citizen NFT contract set
        }
        return citizenNFT.balanceOf(user) > 0;
    }

    /**
     * @dev Internal function to handle XP claiming logic
     * @param user Address to credit XP to
     * @param conditionId ID of the verifier condition
     * @param context Context data for the verifier
     */
    function _claimXPInternal(address user, uint256 conditionId, bytes calldata context) internal {
        require(user != address(0), "Invalid user");
        require(verifiers[conditionId] != address(0), "Verifier not found");
        require(isCitizen(user), "Only citizens can claim XP");

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

        // Ensure sufficient ERC20 balance to cover the payout that will be triggered by this claim
        _checkERC20Balance(user, xpAmount);

        // Mark as used
        usedProofs[claimId] = true;

        // Record verifier claim
        _recordVerifierClaim(user, conditionId);

        // Grant XP to the target user
        _grantXP(user, xpAmount);

        // Automatically claim ERC20 rewards
        _claimERC20Rewards(user);

        emit VerifierClaimed(user, conditionId, xpAmount);
    }

    /**
     * @notice Bulk claim XP on behalf of a user from a staged verifier and automatically claim ERC20 rewards
     * @param user Address to credit XP to
     * @param conditionId ID of the staged verifier condition
     * @param context Context data for the verifier
     */
    function claimBulkXPFor(address user, uint256 conditionId, bytes calldata context) external {
        _claimBulkXPInternal(user, conditionId, context);
    }

    /**
     * @notice Bulk claim XP from a staged verifier and automatically claim ERC20 rewards
     * @param conditionId ID of the staged verifier condition
     * @param context Context data for the verifier
     */
    function claimBulkXP(uint256 conditionId, bytes calldata context) external {
        _claimBulkXPInternal(msg.sender, conditionId, context);
    }

    /**
     * @dev Internal function to handle bulk XP claiming logic
     * @param user Address to credit XP to
     * @param conditionId ID of the staged verifier condition
     * @param context Context data for the verifier
     */
    function _claimBulkXPInternal(address user, uint256 conditionId, bytes calldata context) internal {
        require(user != address(0), "Invalid user");
        require(verifiers[conditionId] != address(0), "Verifier not found");
        require(isCitizen(user), "Only citizens can claim XP");

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

        // Ensure sufficient ERC20 balance to cover the payout that will be triggered by this claim
        _checkERC20Balance(user, totalXP);

        // Mark as used
        usedProofs[claimId] = true;

        // Record verifier claim
        _recordVerifierClaim(user, conditionId);

        // Update user stage in the verifier
        stagedVerifier.updateUserStage(user, highestStage);

        // Grant XP to the target user
        _grantXP(user, totalXP);

        // Automatically claim ERC20 rewards
        _claimERC20Rewards(user);

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
    function _grantXP(address user, uint256 amount) internal virtual {
        uint256 oldLevel = _getUserLevelInternal(user);
        
        userXP[user] += amount;
        
        uint256 newLevel = _getUserLevelInternal(user);

        emit XPEarned(user, amount, userXP[user]);
        
        // Emit level up event if user reached a new level
        if (newLevel > oldLevel) {
            emit LevelUp(user, newLevel, userXP[user]);
        }
    }

    /**
     * @dev Internal function to get user level (for internal use)
     * @param user Address of the user
     * @return Current level
     */
    function _getUserLevelInternal(address user) internal view returns (uint256) {
        if (xpLevels.length == 0) {
            return 0;
        }

        uint256 userTotalXP = userXP[user];
        uint256 currentLevel = 0;

        // Find the highest level the user qualifies for
        for (uint256 i = 0; i < xpLevels.length; i++) {
            if (xpLevels[i].active && userTotalXP >= xpLevels[i].xpThreshold) {
                currentLevel = xpLevels[i].level;
            } else {
                break; // Thresholds are in ascending order, so we can break here
            }
        }

        return currentLevel;
    }

    /**
     * @dev Internal function to check ERC20 balance for projected payout
     * @param user Address of the user
     * @param additionalXP Additional XP that will be added
     */
    function _checkERC20Balance(address user, uint256 additionalXP) internal view {
        if (!erc20RewardConfig.active) return;
        
        uint256 newTotalEarned = ((userXP[user] + additionalXP) * erc20RewardConfig.conversionRate);
        uint256 alreadyClaimed = claimedERC20Rewards[user];
        if (newTotalEarned > alreadyClaimed) {
            uint256 projectedPayout = newTotalEarned - alreadyClaimed;
            uint256 bal = IERC20(erc20RewardConfig.tokenAddress).balanceOf(address(this));
            require(bal >= projectedPayout, "Insufficient ERC20 balance");
        }
    }

    /**
     * @dev Internal function to automatically claim ERC20 rewards when XP is earned
     * @param user Address of the user
     */
    function _claimERC20Rewards(address user) internal {
        if (!erc20RewardConfig.active) {
            return;
        }

        uint256 availableReward = calculateAvailableERC20Reward(user);
        if (availableReward > 0) {
            uint256 bal = IERC20(erc20RewardConfig.tokenAddress).balanceOf(address(this));
            require(bal >= availableReward, "Insufficient ERC20 balance");
            // Update claimed amount
            claimedERC20Rewards[user] += availableReward;
            
            // Transfer tokens
            IERC20(erc20RewardConfig.tokenAddress).safeTransfer(user, availableReward);
            
            emit ERC20RewardClaimed(user, erc20RewardConfig.tokenAddress, availableReward);
        }
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

        // Reset claimed ERC20 rewards
        claimedERC20Rewards[user] = 0;

        // Get all claimed verifiers and reset them
        uint256[] memory claimedVerifiers = userClaimedVerifiers[user];
        for (uint256 i = 0; i < claimedVerifiers.length; i++) {
            userVerifierClaims[user][claimedVerifiers[i]] = false;
        }

        // Clear the claimed verifiers array
        delete userClaimedVerifiers[user];
        
        emit UserReset(user, oldXP, claimedVerifiersCount);
    }

}
