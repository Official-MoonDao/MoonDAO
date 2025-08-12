// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC5643Citizen is ERC721, Ownable {
    mapping(uint256 => uint64) private _expirations;
    uint256 private _totalMinted;
    
    constructor(
        string memory name_,
        string memory symbol_,
        address _treasury,
        address _table,
        address _whitelist,
        address _discountList
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        // Mock constructor - parameters not used in this mock
    }
    
    function mintTo(address to) external onlyOwner {
        _totalMinted += 1;
        uint256 tokenId = _totalMinted;
        _safeMint(to, tokenId);
    }
    
    function balanceOf(address owner) public view override returns (uint256) {
        return super.balanceOf(owner);
    }
    
    function totalSupply() public view returns (uint256) {
        return _totalMinted;
    }
}


