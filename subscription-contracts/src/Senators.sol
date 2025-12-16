// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Senators is Ownable {
    constructor() Ownable(msg.sender) {}

    mapping(address => bool) public senator;
    uint256 public senatorCount;

    function addSenator(address _address) public onlyOwner {
        require(!isSenator(_address), "Already a senator");
        senator[_address] = true;
        senatorCount++;
    }

    function addSenators(address[] memory _addresses) public onlyOwner {
        for (uint256 i = 0; i < _addresses.length; i++) {
            if (!senator[_addresses[i]]){
                senator[_addresses[i]] = true;
                senatorCount++;
            }
        }
    }

    function removeSenator(address _address) public onlyOwner {
        require(!isSenator(_address), "Not a senator");
        senator[_address] = false;
        senatorCount--;
    }

    function isSenator(address _address) public view returns (bool) {
        return senator[_address];
    }

}
