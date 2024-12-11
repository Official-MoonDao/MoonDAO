// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../governance/VotingEscrowDepositor.sol";
import "../governance/SmartWalletChecker.sol";
import "../governance/IVotingEscrow.sol";
import "../tokens/MyToken.sol";

//Using deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
//Deploying MOONEY..
//Deployed MOONEY to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
//Minted 0.0000000001 tokens to deployer address
//Deploying vMOONEY..
//Deployed vMOONEY to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
//Deployment manifest saved to ./deployments/local.json

contract VotingEscrowDepositorTest is Test {
    VotingEscrowDepositor public depositor;
    MyToken public token;
    IVotingEscrow public escrowToken;
    SmartWalletChecker public checker;

    //0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
    address public user = address(0x123);
    //uint256 public initialBalance = 1000;
    uint256 public initialBalance = 126144000 * 2;
    uint256 depositAmount = 126144000;

    address public MOONEY = 0x5FbDB2315678afecb367f032d93F642f64180aa3;

    address public vMOONEY = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;


    function setUp() public {
        token = MyToken(MOONEY);

        escrowToken = IVotingEscrow(vMOONEY);
        vm.prank(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
        depositor = new VotingEscrowDepositor(address(MOONEY), address(vMOONEY));
        checker = new SmartWalletChecker(true);
        checker.approveWallet(address(depositor));
        // TODO we really shouldn't need this?
        checker.approveWallet(address(user));
        //escrowToken.admin();
        vm.prank(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
        escrowToken.commit_smart_wallet_checker(address(checker));
        vm.prank(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
        escrowToken.apply_smart_wallet_checker();
        //token.transfer(address(depositor), initialBalance);
        address[] memory addresses = new address[](1);
        addresses[0] = address(user);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = depositAmount;
        vm.prank(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
        token.approve(address(depositor), depositAmount);
        vm.prank(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
        depositor.increaseWithdrawAmounts(addresses, amounts);
        vm.prank(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
        token.transfer(address(user), initialBalance);
        vm.prank(user);
        token.approve(address(escrowToken), initialBalance);
        vm.prank(user);
        escrowToken.create_lock(initialBalance, block.timestamp + 4*60 * 60 * 24 * 365);
        // Mint tokens for the depositor contract to transfer
        //token.mint(address(depositor), initialBalance);
        vm.prank(user);
        token.approve(address(escrowToken), depositAmount);
        vm.prank(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
        depositor.sendVotingEscrowTokens(address(user), depositAmount);
    }

    function testTransferAndDepositFor() public {
        //uint256 depositAmount = 500;


        // Verify initial balances and deposits
        //assertEq(token.balanceOf(address(depositor)), initialBalance);
        //assertEq(token.balanceOf(user), 0);
        //assertEq(escrowToken.balanceOf(user), initialBalance);
        //escrowToken.checkpoint();

        //assertEq(escrowToken.admin(), address(0));

        // Call transfer_and_deposit_for
        vm.prank(user);
        //depositor.transfer_and_deposit_for(user, depositAmount);
        depositor.withdraw();

        // Verify token transfer
        //assertEq(token.balanceOf(address(depositor)), initialBalance - depositAmount);
        //assertEq(token.balanceOf(user), 0);
        ////assertEq(escrowToken.totalSupply(), initialBalance + depositAmount);
        //escrowToken.user_point_history(user, 0);
        //escrowToken.user_point_history(user, 1);
        //escrowToken.user_point_history(user, 2);
        //escrowToken.get_last_user_slope(user);
        //escrowToken.user_point_history__ts(user, 0);
        //escrowToken.user_point_history__ts(user, 1);
        //escrowToken.user_point_history__ts(user, 2);

        //// Verify escrow deposit
        assertEq(escrowToken.balanceOf(user), depositAmount + initialBalance);
    }
}
