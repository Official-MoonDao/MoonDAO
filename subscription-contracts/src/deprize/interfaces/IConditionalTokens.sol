// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IConditionalTokens
/// @notice Minimal 0.8 view of the externally-deployed (Solidity 0.5) Gnosis
///         `ConditionalTokens` (CTF) contract. Only the ERC-1155 surface the bet
///         router needs in M3 is declared here; resolution/redeem methods
///         (`reportPayouts`, `redeemPositions`) are added in M4.
interface IConditionalTokens {
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
}
