
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {JBERC20} from "nana-core/src/JBERC20.sol";

contract MockJBERC20 is JBERC20 {
    constructor(string memory name, string memory symbol, uint8 decimals) JBERC20() {}

    function mintTo(address _to, uint256 _amount) public {
        _mint(_to, _amount);
    }
}
