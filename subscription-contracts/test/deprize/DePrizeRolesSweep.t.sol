// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILMSRMarketMaker} from "../../src/deprize/interfaces/ILMSRMarketMaker.sol";
import {DePrizeRolesSweep} from "../../script/deprize/DePrizeRolesSweep.s.sol";

contract DePrizeRolesSweepTest is Test {
    DePrizeRolesSweep sweep = new DePrizeRolesSweep();

    function testTransferConditionPinsTreasury() public view {
        DePrizeRolesSweep.ConditionFlat[] memory c = sweep.transferConditions(sweep.TREASURY());
        assertEq(c.length, 2);
        assertEq(c[0].parent, 0);
        assertEq(c[0].paramType, 5, "Calldata");
        assertEq(c[0].operator, 5, "Matches");
        assertEq(c[1].parent, 0);
        assertEq(c[1].paramType, 1, "Static");
        assertEq(c[1].operator, 16, "EqualTo");
        assertEq(abi.decode(c[1].compValue, (address)), sweep.TREASURY());

        address other = address(0xBEEF);
        DePrizeRolesSweep.ConditionFlat[] memory wrong = sweep.transferConditions(other);
        assertFalse(keccak256(wrong[1].compValue) == keccak256(c[1].compValue));
    }

    function testRoleCallsOnlyWithdrawAndTreasuryTransfer() public view {
        address roles = address(0x401E5);
        address keeper = address(0xBEEF);
        address market = address(0xA11CE);
        address weth = address(0xE7E);
        DePrizeRolesSweep.RoleCalls memory c = sweep.roleCalls(roles, keeper, market, weth);

        assertEq(
            c.allowWithdrawFees,
            abi.encodeWithSignature(
                "allowFunction(bytes32,address,bytes4,uint8)",
                sweep.ROLE_KEY(),
                market,
                ILMSRMarketMaker.withdrawFees.selector,
                uint8(0)
            )
        );
        assertEq(c.scopeWeth, abi.encodeWithSignature("scopeTarget(bytes32,address)", sweep.ROLE_KEY(), weth));

        uint256 amount = 1.25 ether;
        (, bytes memory transferCall) = sweep.keeperCalls(roles, market, weth, amount);
        bytes memory expectedTransfer = abi.encodeCall(IERC20.transfer, (sweep.TREASURY(), amount));
        assertTrue(_contains(transferCall, expectedTransfer), "keeper transfer is WETH.transfer to the treasury");
        assertFalse(_contains(transferCall, abi.encodeCall(IERC20.transfer, (keeper, amount))), "keeper is not a recipient");
    }

    function _contains(bytes memory haystack, bytes memory needle) internal pure returns (bool) {
        if (needle.length > haystack.length) return false;
        for (uint256 i; i + needle.length <= haystack.length; i++) {
            bool match_ = true;
            for (uint256 j; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) {
                    match_ = false;
                    break;
                }
            }
            if (match_) return true;
        }
        return false;
    }
}
