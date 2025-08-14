// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./StagedXPVerifier.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title HasTokenBalanceStaged
/// @notice Verifier that awards staged XP based on ERC20 token balance (non-oracle, on-chain verification)
/// @dev Context: abi.encode(uint256 targetStage)
contract HasTokenBalanceStaged is StagedXPVerifier, Ownable {
    address public tokenContract;

    constructor(address _tokenContract) Ownable(msg.sender) {
        require(_tokenContract != address(0), "Invalid token contract");
        tokenContract = _tokenContract;
        
        // Initialize default token balance stages (assuming 18 decimals)
        _addStage(100 * 1e18, 25);     // 100 tokens = 25 XP
        _addStage(500 * 1e18, 50);     // 500 tokens = 50 XP (total: 75 XP)
        _addStage(1000 * 1e18, 100);   // 1000 tokens = 100 XP (total: 175 XP)
        _addStage(5000 * 1e18, 250);   // 5000 tokens = 250 XP (total: 425 XP)
    }

    function name() external pure returns (string memory) {
        return "HasTokenBalanceStaged:v1";
    }

    function setTokenContract(address _tokenContract) external onlyOwner {
        require(_tokenContract != address(0), "Invalid token contract");
        tokenContract = _tokenContract;
    }

    // Admin functions - using inherited onlyOwner modifier
    function addStage(uint256 threshold, uint256 xpAmount) external onlyOwner {
        _addStage(threshold, xpAmount);
    }

    function updateStage(uint256 stageIndex, uint256 threshold, uint256 xpAmount, bool active) external onlyOwner {
        require(stageIndex < stages.length, "Stage does not exist");
        
        stages[stageIndex] = Stage({
            threshold: threshold,
            xpAmount: xpAmount,
            active: active
        });
        
        emit StageUpdated(stageIndex, threshold, xpAmount, active);
    }

    function setStageConfig(
        uint256[] calldata thresholds,
        uint256[] calldata xpAmounts
    ) external onlyOwner {
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
            stages.push(Stage({
                threshold: thresholds[i],
                xpAmount: xpAmounts[i],
                active: true
            }));
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

    /**
     * @dev Implementation of the abstract _checkStageEligibility function using on-chain token balance check
     * @param user Address of the user
     * @param context Encoded context data containing target stage
     * @return eligible Whether the user is eligible
     * @return stageIndex The stage index the user qualifies for
     * @return xpAmount The XP amount for that stage
     */
    function _checkStageEligibility(
        address user,
        bytes calldata context
    ) internal view override returns (bool eligible, uint256 stageIndex, uint256 xpAmount) {
        // Decode the context to get the target stage
        (uint256 targetStage) = abi.decode(context, (uint256));
        
        // Validate stage index
        if (targetStage >= stages.length || !stages[targetStage].active) {
            return (false, 0, 0);
        }
        
        // Get actual token balance from the contract
        uint256 actualBalance = IERC20(tokenContract).balanceOf(user);
        
        // Check if user has enough tokens for this stage
        if (actualBalance >= stages[targetStage].threshold) {
            return (true, targetStage, stages[targetStage].xpAmount);
        }
        
        return (false, 0, 0);
    }

    /**
     * @dev Implementation of the abstract _checkBulkEligibility function for on-chain token balance
     * @param user Address of the user
     * @param context Not used in this implementation since we check on-chain balance directly
     * @return eligible Whether the user's balance is valid
     * @return userMetric The user's current token balance
     */
    function _checkBulkEligibility(
        address user,
        bytes calldata context
    ) internal view override returns (bool eligible, uint256 userMetric) {
        // For token balance, we always return the actual balance since it's verifiable on-chain
        uint256 actualBalance = IERC20(tokenContract).balanceOf(user);
        return (true, actualBalance);
    }

    /**
     * @notice Set the XPManager address (only callable by owner)
     * @param _xpManager Address of the XPManager contract
     */
    function setXPManager(address _xpManager) external override onlyOwner {
        require(_xpManager != address(0), "Invalid XPManager address");
        xpManager = _xpManager;
        emit XPManagerSet(_xpManager);
    }
}
