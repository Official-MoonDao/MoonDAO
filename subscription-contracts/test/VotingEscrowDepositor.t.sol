// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/VotingEscrowDepositor.sol";
import "governance/SmartWalletChecker.sol";
import "tokens/MyToken.sol";

interface IVotingEscrow {
    function create_lock(uint256 _value, uint256 _unlock_time) external;
    function increase_amount(uint256 _value) external;
    function increase_unlock_time(uint256 _unlock_time) external;
    function withdraw() external;
    function balanceOf(address account) external view returns (uint256);
    function commit_smart_wallet_checker(address _checker) external;
    function apply_smart_wallet_checker() external;
}

contract VotingEscrowDepositorTest is Test {
    VotingEscrowDepositor public depositor;
    MyToken public token;
    IVotingEscrow public escrowToken;
    SmartWalletChecker public checker;

    address public user = address(0x123);
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
        // we don't seem to need this in prod, but required for tests
        checker.approveWallet(address(user));
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
        vm.prank(user);
        token.approve(address(escrowToken), depositAmount);
        vm.prank(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
        depositor.sendVotingEscrowTokens(address(user), depositAmount);
    }

    function testTransferAndDepositFor() public {
        vm.prank(user);
        depositor.withdraw();
        assertEq(escrowToken.balanceOf(user), depositAmount + initialBalance);
    }
}
