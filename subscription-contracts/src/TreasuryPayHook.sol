// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IJBPayHook} from "@nana-core-v5/interfaces/IJBPayHook.sol";
import {JBAfterPayRecordedContext} from "@nana-core-v5/structs/JBAfterPayRecordedContext.sol";

/// @notice Forwards the ETH Juicebox sends with a pay to the MoonDAO treasury.
///         Juicebox does not take its protocol fee on amounts forwarded to a
///         pay hook, so the treasury receives the full specification amount.
///         The hook holds nothing: a caller can only forward ETH they attach.
contract TreasuryPayHook is IJBPayHook {
    address public immutable treasury;

    error TreasuryRequired();
    error ValueMismatch(uint256 sent, uint256 forwarded);
    error ForwardFailed();

    event Forwarded(uint256 indexed projectId, address indexed treasury, uint256 amount);

    constructor(address _treasury) {
        if (_treasury == address(0)) revert TreasuryRequired();
        treasury = _treasury;
    }

    function afterPayRecordedWith(JBAfterPayRecordedContext calldata context) external payable override {
        if (msg.value != context.forwardedAmount.value) revert ValueMismatch(msg.value, context.forwardedAmount.value);
        (bool ok,) = treasury.call{value: msg.value}("");
        if (!ok) revert ForwardFailed();
        emit Forwarded(context.projectId, treasury, msg.value);
    }

    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(IJBPayHook).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
