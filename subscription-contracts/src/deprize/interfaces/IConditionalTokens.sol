// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IConditionalTokens
/// @notice Minimal 0.8 view of the externally-deployed (Solidity 0.5) Gnosis
///         `ConditionalTokens` (CTF) contract: the ERC-1155 surface the M3 bet
///         router needs plus the M4 resolution/redemption surface
///         (`reportPayouts`, `redeemPositions`, payout vector reads, id helpers).
interface IConditionalTokens {
    // -----------------------------------------------------------------------
    // ERC-1155 surface (M3)
    // -----------------------------------------------------------------------

    function balanceOf(address owner, uint256 positionId) external view returns (uint256);

    function balanceOfBatch(address[] calldata owners, uint256[] calldata positionIds)
        external
        view
        returns (uint256[] memory);

    function isApprovedForAll(address owner, address operator) external view returns (bool);

    function setApprovalForAll(address operator, bool approved) external;

    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) external;

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external;

    // -----------------------------------------------------------------------
    // Conditions & resolution (M4)
    // -----------------------------------------------------------------------

    /// @notice Prepare a condition. `conditionId = keccak256(oracle, questionId, outcomeSlotCount)`.
    function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount) external;

    /// @notice Oracle resolution. The CTF derives the conditionId from
    ///         `msg.sender` (the oracle), so only the oracle fixed at
    ///         `prepareCondition` time can ever resolve. One-shot: the payout
    ///         vector is write-once (`payoutDenominator` 0 -> sum(payouts)).
    function reportPayouts(bytes32 questionId, uint256[] calldata payouts) external;

    /// @notice Split collateral (or a parent position) into a full set of
    ///         outcome tokens for `partition`.
    function splitPosition(
        address collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata partition,
        uint256 amount
    ) external;

    /// @notice Burn `msg.sender`'s outcome tokens for the given index sets and
    ///         pay out collateral per the reported payout vector. Permissionless;
    ///         reverts until the condition is resolved.
    function redeemPositions(
        address collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata indexSets
    ) external;

    /// @notice Sum of the reported payout vector; 0 until the oracle reports.
    function payoutDenominator(bytes32 conditionId) external view returns (uint256);

    /// @notice Reported payout numerator for one outcome slot (array getter).
    function payoutNumerators(bytes32 conditionId, uint256 index) external view returns (uint256);

    /// @notice Number of outcome slots; 0 if the condition was never prepared.
    function getOutcomeSlotCount(bytes32 conditionId) external view returns (uint256);

    // -----------------------------------------------------------------------
    // Id helpers (mirror CTHelpers)
    // -----------------------------------------------------------------------

    function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount)
        external
        pure
        returns (bytes32);

    function getCollectionId(bytes32 parentCollectionId, bytes32 conditionId, uint256 indexSet)
        external
        view
        returns (bytes32);

    function getPositionId(address collateralToken, bytes32 collectionId) external pure returns (uint256);
}
