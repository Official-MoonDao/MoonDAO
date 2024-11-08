// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20Interface {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IVotingEscrowInterface {
    function deposit_for(address _addr, uint256 _value) external;
}

contract VotingEscrowDepositor  is Ownable{
    IERC20Interface public token;
    IVotingEscrowInterface public escrowToken;
    // map from address to amount availabe to withdraw
    mapping(address => uint256) public availableToWithdraw;
    address[] public withdrawAddresses;

    constructor(address _tokenAddress, address _escrowTokenAddress) {
        token = IERC20Interface(_tokenAddress);
        escrowToken = IVotingEscrowInterface(_escrowTokenAddress);
    }

    function increaseWithdrawAmounts(address[] memory addresses, uint256[] memory amounts) external onlyOwner{
        require(addresses.length == amounts.length, "Arrays must be of equal length");
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < addresses.length; i++) {
            if (availableToWithdraw[addresses[i]] == 0) {
                withdrawAddresses.push(addresses[i]);
            }
            availableToWithdraw[addresses[i]] += amounts[i];
            totalAmount += amounts[i];
        }
        require(token.transferFrom(msg.sender, address(this), totalAmount), "Token transfer failed");
    }

    function clearWithdrawAmounts() external onlyOwner {
        for (uint256 i = 0; i < withdrawAddresses.length; i++) {
            availableToWithdraw[withdrawAddresses[i]] = 0;
        }
        delete withdrawAddresses;
    }

    function withdraw() external {
        uint256 amount = availableToWithdraw[msg.sender];
        require(amount > 0, "No amount available to withdraw");
        availableToWithdraw[msg.sender] = 0;
        require(token.transfer(msg.sender, amount), "Token transfer failed");
        escrowToken.deposit_for(msg.sender, amount);
    }

    function returnTokens() external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        require(token.transfer(msg.sender, balance), "Token transfer failed");
    }
}
