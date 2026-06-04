// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IWETH
/// @notice Wrapped-ETH surface used to convert the 95% bet collateral into the
///         ERC-20 collateral the CTF/LMSR market requires.
interface IWETH is IERC20 {
    function deposit() external payable;

    function withdraw(uint256 amount) external;
}
