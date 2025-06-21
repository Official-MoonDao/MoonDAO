// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract Vesting {
    IERC20 public token;
    address public beneficiary;
    uint256 public immutable start;
    uint256 public immutable cliffDuration;      // 1-year cliff
    uint256 public constant vestingDuration = 4 * 365 days;  // 4-year vesting
    uint256 public totalWithdrawn;                         // Total tokens already withdrawn

    constructor(address _beneficiary) {
        beneficiary = _beneficiary;
        if (block.chainid != 11155111){
            cliffDuration = 365 days; // 1-year cliff
        } else {
            cliffDuration = 0; // No cliff for Sepolia to make testing easier
        }
        start = block.timestamp; // Vesting starts immediately upon deployment
    }

    // Set the token to be vested (only once)
    function setToken(address _token) external {
        require(address(token) == address(0), "Token already set");
        token = IERC20(_token);
    }

    // Instead of tracking deposits manually, we compute total received as:
    // (current balance + tokens already withdrawn)
    function totalReceived() public view returns (uint256) {
        return token.balanceOf(address(this)) + totalWithdrawn;
    }

    // Calculate the total vested tokens based on the contract's creation time
    function vestedAmount() public view returns (uint256) {
        uint256 totalDeposited = totalReceived();
        if (block.timestamp < start + cliffDuration) {
            return 0; // Nada vests until the cliff period is over
        } else if (block.timestamp >= start + vestingDuration) {
            return totalDeposited; // Everything's vested after 4 years
        } else {
            // Linear vesting: tokens vest proportional to time elapsed since contract creation
            uint256 timeElapsed = block.timestamp - start;
            return (totalDeposited * timeElapsed) / vestingDuration;
        }
    }

    // Beneficiary can withdraw vested tokens
    function withdraw() external {
        require(msg.sender == beneficiary, "Only beneficiary can withdraw");
        uint256 vested = vestedAmount();
        uint256 withdrawable = vested - totalWithdrawn;
        require(withdrawable > 0, "No tokens available for withdrawal");
        totalWithdrawn += withdrawable;
        require(token.transfer(beneficiary, withdrawable), "Token transfer failed");
    }
}
