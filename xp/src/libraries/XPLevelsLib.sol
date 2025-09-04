// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title XPLevelsLib
 * @dev Library for XP level calculations to reduce contract size
 */
library XPLevelsLib {
    struct XPLevel {
        uint256 xpThreshold;
        uint256 level;
        bool active;
    }

    /**
     * @dev Get level for a specific XP amount
     */
    function getLevelForXP(XPLevel[] storage xpLevels, uint256 xpAmount) internal view returns (uint256) {
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
     * @dev Get next level information for a user
     */
    function getNextLevelInfo(
        XPLevel[] storage xpLevels, 
        uint256 userTotalXP
    ) internal view returns (uint256 nextLevel, uint256 xpRequired, uint256 xpProgress) {
        if (xpLevels.length == 0) {
            return (0, 0, 0);
        }

        // Find current level and next level
        for (uint256 i = 0; i < xpLevels.length; i++) {
            if (xpLevels[i].active && userTotalXP >= xpLevels[i].xpThreshold) {
                // Continue to find the highest level
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
     * @dev Validate XP levels configuration
     */
    function validateLevels(uint256[] calldata thresholds, uint256[] calldata levels) internal pure {
        require(thresholds.length == levels.length, "Arrays length mismatch");
        require(thresholds.length > 0, "No levels provided");

        // Validate thresholds are in ascending order
        for (uint256 i = 1; i < thresholds.length; i++) {
            require(thresholds[i] > thresholds[i - 1], "Thresholds must be ascending");
        }
    }

    /**
     * @dev Set XP levels from arrays
     */
    function setLevelsFromArrays(
        XPLevel[] storage xpLevels,
        uint256[] calldata thresholds, 
        uint256[] calldata levels
    ) internal {
        // Clear existing levels by setting length to 0
        while (xpLevels.length > 0) {
            xpLevels.pop();
        }

        // Add new levels
        for (uint256 i = 0; i < thresholds.length; i++) {
            xpLevels.push(XPLevel({xpThreshold: thresholds[i], level: levels[i], active: true}));
        }
    }

    /**
     * @dev Get XP levels as arrays
     */
    function getLevelsAsArrays(XPLevel[] storage xpLevels) 
        internal 
        view 
        returns (uint256[] memory thresholds, uint256[] memory levels, bool active) 
    {
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
}
