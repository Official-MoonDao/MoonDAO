// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./XPOracleVerifier.sol";
import "./StagedXPVerifier.sol";
import "../interfaces/IXPVerifier.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title HasContributedStaged
/// @notice Verifier that awards staged XP based on contribution milestones
/// @dev Context: abi.encode(uint256 contributions, uint256 xpAmount, uint256 validAfter, uint256 validBefore, bytes signature)
contract HasContributedStaged is XPOracleVerifier, StagedXPVerifier {
    constructor(address _oracle) XPOracleVerifier(_oracle) {
        // Initialize default contribution stages
        _addStage(1, 25); // 1 contribution = 25 XP
        _addStage(3, 50); // 3 contributions = 50 XP (total: 75 XP)
        _addStage(10, 100); // 10 contributions = 100 XP (total: 175 XP)
        _addStage(25, 200); // 25 contributions = 200 XP (total: 375 XP)
        _addStage(50, 500); // 50 contributions = 500 XP (total: 875 XP)
    }

    // Admin functions - using inherited onlyOwner modifier from XPOracleVerifier -> Ownable
    function addStage(uint256 threshold, uint256 xpAmount) external onlyOwner {
        _addStage(threshold, xpAmount);
    }

    function updateStage(uint256 stageIndex, uint256 threshold, uint256 xpAmount, bool active) external onlyOwner {
        require(stageIndex < stages.length, "Stage does not exist");

        stages[stageIndex] = Stage({threshold: threshold, xpAmount: xpAmount, active: active});

        emit StageUpdated(stageIndex, threshold, xpAmount, active);
    }

    function setStageConfig(uint256[] calldata thresholds, uint256[] calldata xpAmounts) external onlyOwner {
        require(thresholds.length == xpAmounts.length, "Arrays length mismatch");
        require(thresholds.length > 0, "No stages provided");

        // Validate thresholds are in ascending order
        for (uint256 i = 1; i < thresholds.length; i++) {
            require(thresholds[i] > thresholds[i - 1], "Thresholds must be ascending");
        }

        // Clear existing stages
        delete stages;

        // Add new stages
        for (uint256 i = 0; i < thresholds.length; i++) {
            stages.push(Stage({threshold: thresholds[i], xpAmount: xpAmounts[i], active: true}));
        }

        emit StageConfigSet(thresholds, xpAmounts);
    }

    function deactivateAllStages() external onlyOwner {
        for (uint256 i = 0; i < stages.length; i++) {
            stages[i].active = false;
        }
        emit AllStagesDeactivated();
    }

    function resetUserStage(address user) external onlyOwner {
        uint256 previousStage = userHighestClaimedStage[user];
        userHighestClaimedStage[user] = 0;
        emit UserStageProgressed(user, previousStage, 0, 0);
    }

    function name() external pure returns (string memory) {
        return "HasContributedStaged:v1";
    }

    /**
     * @dev Implementation of the abstract _checkStageEligibility function
     * @dev Uses your existing oracle backend format with contributions
     * @param user Address of the user
     * @param context Raw context data from your existing backend
     * @return eligible Whether the user is eligible
     * @return stageIndex The stage index the user qualifies for
     * @return xpAmount The XP amount for that stage
     */
    function _checkStageEligibility(address user, bytes calldata context)
        internal
        view
        override
        returns (bool eligible, uint256 stageIndex, uint256 xpAmount)
    {
        (uint256 contributions,, uint256 validAfterTs, uint256 validBefore, bytes memory signature) =
            abi.decode(context, (uint256, uint256, uint256, uint256, bytes));

        // Find which stage this contributions corresponds to
        stageIndex = _findStageByThreshold(contributions);
        if (stageIndex == type(uint256).max) {
            return (false, 0, 0); // No stage matches this threshold
        }

        // Verify oracle proof using your existing backend format
        _verifyOracleProof(
            user,
            keccak256(abi.encode(contributions)),
            stages[stageIndex].xpAmount,
            validAfterTs,
            validBefore,
            signature
        );

        return (true, stageIndex, stages[stageIndex].xpAmount);
    }

    /**
     * @dev Override claimId to match your existing backend format
     * @param user Address of the user
     * @param context Raw context data from your existing backend
     * @return Unique claim identifier
     */
    function claimId(address user, bytes calldata context)
        external
        view
        override(IXPVerifier, StagedXPVerifier)
        returns (bytes32)
    {
        (uint256 contributions, uint256 amount, uint256 validAfterTs, uint256 validBefore,) =
            abi.decode(context, (uint256, uint256, uint256, uint256, bytes));

        // Use your original claimId format for backwards compatibility
        bytes32 contextHash = keccak256(abi.encode(contributions, amount, validAfterTs, validBefore));
        return keccak256(abi.encodePacked(address(this), user, contextHash));
    }

    /**
     * @dev Implementation of the abstract _checkBulkEligibility function
     * @param user Address of the user
     * @param context Raw context data from your existing backend
     * @return eligible Whether the user's proof is valid
     * @return userMetric The user's current contribution count
     */
    function _checkBulkEligibility(address user, bytes calldata context)
        internal
        view
        override
        returns (bool eligible, uint256 userMetric)
    {
        (uint256 contributions,, uint256 validAfterTs, uint256 validBefore, bytes memory signature) =
            abi.decode(context, (uint256, uint256, uint256, uint256, bytes));

        // For bulk claims, the contributions in context represents the user's actual contribution count
        // Verify oracle proof using your existing backend format
        _verifyOracleProof(
            user,
            keccak256(abi.encode(contributions)),
            0, // XP amount not used in verification, will be calculated during bulk claim
            validAfterTs,
            validBefore,
            signature
        );

        return (true, contributions);
    }

    /**
     * @dev Find the stage index that matches the given threshold
     * @param threshold The threshold to find
     * @return stageIndex The stage index, or type(uint256).max if not found
     */
    function _findStageByThreshold(uint256 threshold) internal view returns (uint256) {
        for (uint256 i = 0; i < stages.length; i++) {
            if (stages[i].threshold == threshold && stages[i].active) {
                return i;
            }
        }
        return type(uint256).max;
    }
}
