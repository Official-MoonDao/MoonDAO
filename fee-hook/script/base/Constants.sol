// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";

/// @notice Shared constants used in scripts
contract Constants {
    int24 tickSpacing = 200;
    /// Same address across chains
    IAllowanceTransfer constant PERMIT2 = IAllowanceTransfer(address(0x000000000022D473030F116dDEE9F6B43aC78BA3));
}
