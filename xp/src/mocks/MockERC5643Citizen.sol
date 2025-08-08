// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC5643Citizen is Ownable {
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    uint256 private _tokenIdCounter;
    
    constructor(
        string memory name_,
        string memory symbol_,
        address _treasury,
        address _table,
        address _whitelist,
        address _discountList
    ) Ownable(msg.sender) {
        // Mock constructor - parameters not used in this mock
    }
    
    function mintTo(address to) external onlyOwner {
        _tokenIdCounter++;
        _owners[_tokenIdCounter] = to;
        _balances[to]++;
    }
    
    function balanceOf(address owner) public view returns (uint256) {
        return _balances[owner];
    }
    
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }
}
