// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IXPVerifier.sol";

/// @title StagedXPVerifier
/// @notice Abstract base contract for verifiers that award XP in stages based on user progression
/// @dev Concrete implementations must define their own stages and verification logic
/// @dev Admin functions are implemented in concrete contracts that have access control
abstract contract StagedXPVerifier is IXPVerifier {
    struct Stage {
        uint256 threshold;      // Minimum requirement for this stage (votes, contributions, etc.)
        uint256 xpAmount;       // XP awarded for reaching this stage
        bool active;            // Whether this stage is currently active
    }
    
    Stage[] public stages;
    
    // Track highest stage claimed by each user
    mapping(address => uint256) public userHighestClaimedStage;
    
    event StageAdded(uint256 indexed stageIndex, uint256 threshold, uint256 xpAmount);
    event StageUpdated(uint256 indexed stageIndex, uint256 threshold, uint256 xpAmount, bool active);
    event StageConfigSet(uint256[] thresholds, uint256[] xpAmounts);
    event AllStagesDeactivated();
    event UserStageProgressed(address indexed user, uint256 previousStage, uint256 newStage, uint256 xpAwarded);

    constructor() {
        // Stages must be initialized by the concrete implementation
    }

    /**
     * @notice Check if a user is eligible for a specific stage
     * @param user Address of the user
     * @param context Encoded context data
     * @return eligible Whether the user is eligible
     * @return xpAmount Amount of XP to award
     */
    function isEligible(address user, bytes calldata context)
        external
        view
        returns (bool eligible, uint256 xpAmount)
    {
        // Delegate to concrete implementation for context parsing and verification
        (bool stageEligible, uint256 stageIndex, uint256 xpReward) = _checkStageEligibility(user, context);
        
        if (!stageEligible) {
            return (false, 0);
        }

        // Validate target stage exists and is active
        require(stageIndex < stages.length, "Invalid stage");
        require(stages[stageIndex].active, "Stage not active");
        
        // Check if user has already claimed this stage or higher
        if (userHighestClaimedStage[user] >= stageIndex) {
            return (false, 0);
        }
        
        // If this isn't the next sequential stage, check if user has claimed all previous stages
        if (stageIndex > 0 && userHighestClaimedStage[user] < stageIndex - 1) {
            return (false, 0); // Must claim stages sequentially
        }

        return (true, xpReward);
    }

    /**
     * @notice Generate a unique claim ID for a user and context
     * @dev Delegates to concrete implementation since context format varies
     * @param user Address of the user
     * @param context Encoded context data
     * @return Unique claim identifier
     */
    function claimId(address user, bytes calldata context) external view virtual returns (bytes32) {
        // Default implementation - concrete contracts should override if needed
        return keccak256(abi.encodePacked(address(this), user, context));
    }

    /**
     * @notice Get all stages configuration
     * @return Array of all stages with their thresholds and XP amounts
     */
    function getAllStages() external view returns (Stage[] memory) {
        return stages;
    }

    /**
     * @notice Get stage configuration (similar to ERC20 rewards format)
     * @return thresholds Array of threshold requirements
     * @return xpAmounts Array of XP amounts
     * @return activeFlags Array of active status for each stage
     */
    function getStageConfig() external view returns (
        uint256[] memory thresholds,
        uint256[] memory xpAmounts,
        bool[] memory activeFlags
    ) {
        thresholds = new uint256[](stages.length);
        xpAmounts = new uint256[](stages.length);
        activeFlags = new bool[](stages.length);
        
        for (uint256 i = 0; i < stages.length; i++) {
            thresholds[i] = stages[i].threshold;
            xpAmounts[i] = stages[i].xpAmount;
            activeFlags[i] = stages[i].active;
        }
        
        return (thresholds, xpAmounts, activeFlags);
    }

    /**
     * @notice Get a specific stage configuration
     * @param stageIndex Index of the stage to retrieve
     * @return stage The stage configuration
     */
    function getStage(uint256 stageIndex) external view returns (Stage memory stage) {
        require(stageIndex < stages.length, "Stage does not exist");
        return stages[stageIndex];
    }

    /**
     * @notice Get the total number of stages
     * @return Total number of configured stages
     */
    function getStageCount() external view returns (uint256) {
        return stages.length;
    }

    /**
     * @notice Get the highest stage a user has claimed
     * @param user Address of the user
     * @return Highest stage index claimed by the user
     */
    function getUserHighestStage(address user) external view returns (uint256) {
        return userHighestClaimedStage[user];
    }

    /**
     * @notice Find the next claimable stage for a user given their metric
     * @param user Address of the user
     * @param userMetric Current metric value for the user (votes, contributions, etc.)
     * @return nextStage Index of the next claimable stage, or type(uint256).max if none
     */
    function getNextClaimableStage(address user, uint256 userMetric) external view returns (uint256 nextStage) {
        uint256 currentHighest = userHighestClaimedStage[user];
        
        // Check if user can claim the next sequential stage
        uint256 targetStage = currentHighest + 1;
        
        if (targetStage >= stages.length) {
            return type(uint256).max; // No more stages available
        }
        
        if (!stages[targetStage].active) {
            return type(uint256).max; // Next stage is not active
        }
        
        if (userMetric >= stages[targetStage].threshold) {
            return targetStage;
        }
        
        return type(uint256).max; // User doesn't meet threshold yet
    }

    /**
     * @notice Calculate total XP earned if user claims all eligible stages
     * @param user Address of the user
     * @param userMetric Current metric value for the user
     * @return totalXP Total XP that can be claimed
     */
    function calculateTotalClaimableXP(address user, uint256 userMetric) external view returns (uint256 totalXP) {
        uint256 currentHighest = userHighestClaimedStage[user];
        
        for (uint256 i = currentHighest + 1; i < stages.length; i++) {
            if (!stages[i].active) break;
            if (userMetric < stages[i].threshold) break;
            totalXP += stages[i].xpAmount;
        }
        
        return totalXP;
    }

    /**
     * @notice Abstract function that concrete implementations must override to check stage-specific eligibility
     * @dev This function should parse the context, verify eligibility, and return the stage info
     * @param user Address of the user
     * @param context Raw context data to be parsed by the concrete implementation
     * @return eligible Whether the user is eligible for any stage
     * @return stageIndex The stage index the user is eligible for
     * @return xpAmount The XP amount for that stage
     */
    function _checkStageEligibility(
        address user,
        bytes calldata context
    ) internal view virtual returns (bool eligible, uint256 stageIndex, uint256 xpAmount);

    /**
     * @dev Internal function to add a new stage
     * @param threshold Minimum requirement for this stage
     * @param xpAmount XP awarded for reaching this stage
     */
    function _addStage(uint256 threshold, uint256 xpAmount) internal {
        stages.push(Stage({
            threshold: threshold,
            xpAmount: xpAmount,
            active: true
        }));
        
        emit StageAdded(stages.length - 1, threshold, xpAmount);
    }

    /**
     * @notice Optional cooldown logic - default implementation returns 0 (no cooldown)
     * @dev Concrete implementations can override this if they need cooldown logic
     */
    function validAfter(address, bytes calldata) external pure virtual returns (uint256) {
        return 0;
    }
}
