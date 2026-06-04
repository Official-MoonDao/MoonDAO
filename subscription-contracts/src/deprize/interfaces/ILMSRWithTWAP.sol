// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ILMSRWithTWAP
/// @notice Minimal 0.8 view of the externally-deployed (Solidity 0.5) `LMSRWithTWAP`
///         market maker (Gnosis `LMSRMarketMaker` + MoonDAO's TWAP extension).
/// @dev The market maker itself cannot be compiled in this 0.8 project; we only
///      call the deployed instance through this interface. See
///      `prediction/contracts/LMSRWithTWAP.sol` for the source.
interface ILMSRWithTWAP {
    /// @notice Outcome-token net cost (positive) or proceeds (negative) of a trade,
    ///         **excluding** the market-maker fee.
    /// @dev The total collateral {trade} actually pulls is
    ///      `calcNetCost(amounts) + calcMarketFee(|calcNetCost(amounts)|)`. Callers
    ///      must fund/approve and cap (`collateralLimit`) against that fee-inclusive
    ///      total, not `calcNetCost` alone.
    /// @param outcomeTokenAmounts Signed amount per outcome slot; positive = buy.
    function calcNetCost(int256[] calldata outcomeTokenAmounts) external view returns (int256);

    /// @notice Fee the market maker charges on `outcomeTokenCost`, computed as
    ///         `outcomeTokenCost * fee() / 1e18` (matches MarketMaker.calcMarketFee).
    function calcMarketFee(uint256 outcomeTokenCost) external view returns (uint256);

    /// @notice Accumulate the time-weighted price. Called by the router before
    ///         `trade` to preserve TWAP (since calling `trade` directly skips the
    ///         update that `tradeWithTWAP` would otherwise perform via a self-call).
    function updateCumulativeTWAP() external;

    /// @notice Current marginal price (probability, fixed-point) for an outcome slot.
    function calcMarginalPrice(uint8 outcomeTokenIndex) external view returns (uint256);

    /// @notice Execute a trade, capped at `collateralLimit`. Mints/burns ERC-1155
    ///         outcome tokens to/from `msg.sender` via the conditional tokens system.
    function trade(int256[] calldata outcomeTokenAmounts, int256 collateralLimit) external returns (int256 netCost);

    /// @notice Same as {trade} but first accumulates the time-weighted price.
    function tradeWithTWAP(int256[] calldata outcomeTokenAmounts, int256 collateralLimit) external;

    /// @notice Number of atomic outcome slots (equals the condition's outcome count
    ///         for a single-condition market).
    function atomicOutcomeSlotCount() external view returns (uint256);

    /// @notice The conditional tokens system (CTF) this market settles against.
    function pmSystem() external view returns (address);

    /// @notice The ERC-20 collateral token (WETH for MoonDAO markets).
    function collateralToken() external view returns (address);

    /// @notice Market maker fee, as a fraction of 1e18.
    function fee() external view returns (uint64);

    /// @notice Lifecycle stage of the market maker (0 = Running, 1 = Paused, 2 = Closed).
    function stage() external view returns (uint8);

    /// @notice Condition ID at the given index (for single-condition markets, use index 0).
    function conditionIds(uint256 index) external view returns (bytes32);
}
