// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./VotingEscrowDepositor.sol";

contract VMooneyFaucet {
    IERC20 MOONEY;
    IERC20 vMOONEY;
    VotingEscrowDepositor depositor;

    constructor(address _mooneyAddress, address _vMooneyAddress, address _depositorAddress) {
        MOONEY = IERC20(_mooneyAddress);
        vMOONEY = IERC20(_vMooneyAddress);
        depositor = VotingEscrowDepositor(_depositorAddress);
    }

    function drip() external {
        require(MOONEY.balanceOf(msg.sender) == 0, "You already have MOONEY");
        require(vMOONEY.balanceOf(msg.sender) == 0, "You already have vMOONEY");
        require(depositor.availableToWithdraw(msg.sender) > 0, "No amount available to withdraw");
        require(MOONEY.balanceOf(address(this)) >= 1e18, "Not enough MOONEY in faucet");
        MOONEY.transfer(msg.sender, 1e18); // 1 MOONEY
    }

}
