// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/VMooneyFaucet.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol, uint256 initialSupply) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract VMooneyFaucetTest is Test {
    VMooneyFaucet public faucet;
    MockERC20 public MOONEY;
    MockERC20 public vMOONEY;
    VotingEscrowDepositor public depositor;

    address public user = address(0x123);
    address public user2 = address(0x124);
    address public deployer = address(0x456);
    uint256 public initialBalance = 126144000 * 2;
    uint256 depositAmount = 126144000;

    function setUp() public {
        MOONEY = new MockERC20("MOONEY", "MOONEY", initialBalance);
        vMOONEY = new MockERC20("vMOONEY", "vMOONEY", initialBalance);
        vm.startPrank(deployer);
        depositor = new VotingEscrowDepositor(address(MOONEY), address(vMOONEY));
        vm.stopPrank();
        faucet = new VMooneyFaucet(address(MOONEY), address(vMOONEY), address(depositor));
        vm.startPrank(user);
        MOONEY.mint(deployer, initialBalance);
        vm.stopPrank();
    }

    function testDrip() public {
        vm.startPrank(user);
        MOONEY.mint(address(faucet), 1e18);
        vMOONEY.mint(address(faucet), 1e18);
        address[] memory addresses = new address[](1);
        addresses[0] = address(user);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = depositAmount;
        vm.stopPrank();
        vm.startPrank(deployer);
        MOONEY.approve(address(depositor), depositAmount);
        depositor.increaseWithdrawAmounts(addresses, amounts);
        vm.stopPrank();
        vm.startPrank(user);
        uint256 userBalanceBefore = MOONEY.balanceOf(user);
        faucet.drip();
        uint256 userBalanceAfter = MOONEY.balanceOf(user);
        assertEq(userBalanceAfter, userBalanceBefore + 1e18, "User should receive 1 MOONEY");
        vm.stopPrank();
    }

    function testDripNoBalance() public {
        vm.startPrank(user2);
        MOONEY.mint(address(faucet), 1e18);
        vMOONEY.mint(address(faucet), 1e18);
        vm.expectRevert("No amount available to withdraw");
        faucet.drip();

    }

    function testDripAlreadyHasMOONEY() public {
        vm.startPrank(user);
        MOONEY.mint(address(user), 1e18);
        vm.expectRevert("You already have MOONEY");
        faucet.drip();
    }

    function testDripAlreadyHasVMOONEY() public {
        vm.startPrank(user);
        vMOONEY.mint(address(user), 1e18);
        vm.expectRevert("You already have vMOONEY");
        faucet.drip();
    }
}
