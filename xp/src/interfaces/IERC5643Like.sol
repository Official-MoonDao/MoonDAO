// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC5643Like {
    function balanceOf(address owner) external view returns (uint256);
}
