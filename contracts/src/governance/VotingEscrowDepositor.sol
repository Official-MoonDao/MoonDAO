// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
}

interface IVotingEscrow {
    function deposit_for(address _addr, uint256 _value) external;
}

contract VotingEscrowDepositor {
    IERC20 public token;
    IVotingEscrow public escrowToken;

    constructor(address _tokenAddress, address _escrowTokenAddress) {
        token = IERC20(_tokenAddress);
        escrowToken = IVotingEscrow(_escrowTokenAddress);
    }

    function transfer_and_deposit_for(address addr, uint256 value) external {
        require(token.transfer(addr, value), "Token transfer failed");
        escrowToken.deposit_for(addr, value);
    }
}
