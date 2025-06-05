// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FakeERC20 is ERC20 {
    constructor(uint256 initialSupply, string memory name, string memory symbol, address owner) ERC20(name, symbol) {
        _mint(owner, initialSupply);
    }
}
