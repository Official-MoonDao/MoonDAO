// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {IWETH} from "../../src/deprize/interfaces/IWETH.sol";

/// @title ArbitrumWethPreflight
/// @notice AUDIT[plan Phase 2 WETH pre-flight]: 1-wei deposit/withdraw against
///         the live aeWETH proxy. Skips unless DEPRIZE_FORK_RPC is set.
///
///   DEPRIZE_FORK_RPC=<arbitrum rpc> forge test --match-contract ArbitrumWethPreflight -vvv
contract ArbitrumWethPreflight is Test {
    address constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    function setUp() public {
        string memory rpc = vm.envOr("DEPRIZE_FORK_RPC", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
    }

    function testDepositWithdrawRoundTrip() public {
        if (WETH.code.length == 0) return; // not forked / wrong chain

        address user = address(0xBEEF);
        vm.deal(user, 1 ether);
        vm.startPrank(user);

        uint256 beforeEth = user.balance;
        uint256 beforeWeth = IWETH(WETH).balanceOf(user);

        IWETH(WETH).deposit{value: 1}();
        assertEq(IWETH(WETH).balanceOf(user), beforeWeth + 1, "deposit did not credit WETH");

        IWETH(WETH).withdraw(1);
        assertEq(IWETH(WETH).balanceOf(user), beforeWeth, "withdraw did not burn WETH");
        assertEq(user.balance, beforeEth, "withdraw did not return ETH");

        vm.stopPrank();
    }
}
