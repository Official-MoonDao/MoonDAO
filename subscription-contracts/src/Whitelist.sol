// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Whitelist is Ownable {
    constructor() Ownable(msg.sender) {}

    mapping(address => bool) public whitelist;

    function addToWhitelist(address _address) public onlyOwner {
        whitelist[_address] = true;
    }

    function batchAddToWhitelist(address[] memory _addresses) public onlyOwner {
        for (uint256 i = 0; i < _addresses.length; i++) {
            whitelist[_addresses[i]] = true;
        }
    }

    function removeFromWhitelist(address _address) public onlyOwner {
        whitelist[_address] = false;
    }

    function isWhitelisted(address _address) public view returns (bool) {
        return whitelist[_address];
    }

}