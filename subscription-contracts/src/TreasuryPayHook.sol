// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IJBPayHook} from "@nana-core-v5/interfaces/IJBPayHook.sol";
import {JBAfterPayRecordedContext} from "@nana-core-v5/structs/JBAfterPayRecordedContext.sol";

/// @notice Forwards the ETH a Juicebox terminal sends with a pay hook specification
///         to the MoonDAO treasury. Holds nothing between calls.
contract TreasuryPayHook is IJBPayHook {
    address public immutable treasury;

    constructor(address _treasury) {
        require(_treasury != address(0), "treasury is zero");
        treasury = _treasury;
    }

    function afterPayRecordedWith(JBAfterPayRecordedContext calldata) external payable override {
        (bool ok,) = treasury.call{value: msg.value}("");
        require(ok, "treasury transfer failed");
    }

    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(IJBPayHook).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
