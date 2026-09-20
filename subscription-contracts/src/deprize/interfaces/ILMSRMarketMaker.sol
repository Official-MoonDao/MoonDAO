// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ILMSRMarketMaker
/// @notice Minimal 0.8 view of the externally-deployed (Solidity 0.5), unmodified
///         Gnosis `LMSRMarketMaker` (package conditional-tokens-market-makers 1.8.1).
/// @dev The market maker cannot be compiled in this 0.8 project; we only call the
///      deployed clone through this interface. No MoonDAO subclass exists in v2.
interface ILMSRMarketMaker {
    /// @notice Outcome-token net cost (positive) or proceeds (negative) of a trade,
    ///         **excluding** the market-maker fee.
    /// @dev The collateral {trade} actually pulls is
    ///      `calcNetCost(amounts) + calcMarketFee(|calcNetCost(amounts)|)`.
    function calcNetCost(int256[] calldata outcomeTokenAmounts) external view returns (int256);

    /// @notice Fee charged on `outcomeTokenCost`: `outcomeTokenCost * fee() / 1e18`.
    function calcMarketFee(uint256 outcomeTokenCost) external view returns (uint256);

    /// @notice Current marginal price (probability, fixed-point 1e18) for a slot.
    function calcMarginalPrice(uint8 outcomeTokenIndex) external view returns (uint256);

    /// @notice Execute a trade, capped at `collateralLimit`. Moves ERC-1155 outcome
    ///         tokens between the market and `msg.sender` via the CTF.
    function trade(int256[] calldata outcomeTokenAmounts, int256 collateralLimit) external returns (int256 netCost);

    function atomicOutcomeSlotCount() external view returns (uint256);
    function pmSystem() external view returns (address);
    function collateralToken() external view returns (address);
    function conditionIds(uint256 index) external view returns (bytes32);
    function fee() external view returns (uint64);
    function funding() external view returns (uint256);

    /// @notice 0 = Running, 1 = Paused, 2 = Closed.
    function stage() external view returns (uint8);

    // -----------------------------------------------------------------------
    // Owner surface. In v2 the owner is the admin Safe directly.
    // -----------------------------------------------------------------------

    function owner() external view returns (address);
    function transferOwnership(address newOwner) external;
    function pause() external;
    function resume() external;

    /// @notice Close the market: pushes remaining outcome-token inventory to the
    ///         owner and sets stage to Closed.
    function close() external;

    /// @notice Withdraw the market's standalone collateral balance (accrued fees) to the owner.
    function withdrawFees() external returns (uint256 fees);
}
