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
    uint256 public initialBalance = 126144000 * 2;
    uint256 depositAmount = 126144000;

    function setUp() public {
        MOONEY = new MockERC20("MOONEY", "MOONEY", initialBalance);
        vMOONEY = new MockERC20("vMOONEY", "vMOONEY", initialBalance);
        depositor = new VotingEscrowDepositor(address(MOONEY), address(vMOONEY));
        faucet = new VMooneyFaucet(address(MOONEY), address(vMOONEY), address(depositor));
        vm.startPrank(user);
        MOONEY.mint(user, initialBalance);
        vMOONEY.mint(user, initialBalance);
        vm.stopPrank();
    }

    function testDrip() {
        vm.startPrank(user);
        MOONEY.mint(address(faucet), 1e18);
        vMOONEY.mint(address(faucet), 1e18);
        depositor.increaseWithdrawAmounts([user], [depositAmount]);
        uint256 userBalanceBefore = MOONEY.balanceOf(user);
        faucet.drip();
        uint256 userBalanceAfter = MOONEY.balanceOf(user);
        assertEq(userBalanceAfter, userBalanceBefore + 1e18, "User should receive 1 MOONEY");
        vm.stopPrank();
    }
}
