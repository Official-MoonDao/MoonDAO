
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/VotingEscrowDepositor.sol";

//Using deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
//Deploying MOONEY..
//Deployed MOONEY to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
//Minted 0.0000000001 tokens to deployer address
//Deploying vMOONEY..
//Deployed vMOONEY to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
//Deployment manifest saved to ./deployments/local.json

address MOONEY = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;
address vMOONEY = 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0;
contract MockToken is IERC20 {
    mapping(address => uint256) public balanceOf;

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
}

contract MockVotingEscrow is IVotingEscrow {
    mapping(address => uint256) public deposits;

    function deposit_for(address _addr, uint256 _value) external override {
        deposits[_addr] += _value;
    }
}

contract VotingEscrowDepositorTest is Test {
    VotingEscrowDepositor public depositor;
    MockToken public token;
    MockVotingEscrow public escrowToken;

    address public user = address(0x123);
    uint256 public initialBalance = 1000;

    function setUp() public {
        token = new MockToken();
        escrowToken = new MockVotingEscrow();
        depositor = new VotingEscrowDepositor(address(MOONEY), address(vMOONEY));

        // Mint tokens for the depositor contract to transfer
        token.mint(address(depositor), initialBalance);
    }

    function testTransferAndDepositFor() public {
        uint256 depositAmount = 500;

        // Verify initial balances and deposits
        assertEq(token.balanceOf(address(depositor)), initialBalance);
        assertEq(token.balanceOf(user), 0);
        assertEq(escrowToken.deposits(user), 0);

        // Call transfer_and_deposit_for
        depositor.transfer_and_deposit_for(user, depositAmount);

        // Verify token transfer
        assertEq(token.balanceOf(address(depositor)), initialBalance - depositAmount);
        assertEq(token.balanceOf(user), depositAmount);

        // Verify escrow deposit
        assertEq(escrowToken.deposits(user), depositAmount);
    }
}
