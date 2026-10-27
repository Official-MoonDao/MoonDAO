// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice 2.5% launchpad treasury fee, taken from a contribution before it
///         is recorded in the project. 250 / 10_000.
library TreasuryFeeMath {
    uint256 internal constant FEE_NUMERATOR = 250;
    uint256 internal constant FEE_DENOMINATOR = 10_000;
    uint256 internal constant KEPT_NUMERATOR = FEE_DENOMINATOR - FEE_NUMERATOR;

    function fee(uint256 amount) internal pure returns (uint256) {
        return (amount * FEE_NUMERATOR) / FEE_DENOMINATOR;
    }

    function kept(uint256 amount) internal pure returns (uint256) {
        return (amount * KEPT_NUMERATOR) / FEE_DENOMINATOR;
    }

    /// @notice Smallest gross payment whose kept amount is at least `net`.
    function grossToKeep(uint256 net) internal pure returns (uint256 gross) {
        gross = (net * FEE_DENOMINATOR + KEPT_NUMERATOR - 1) / KEPT_NUMERATOR;
        while (kept(gross) < net) {
            gross++;
        }
    }
}
