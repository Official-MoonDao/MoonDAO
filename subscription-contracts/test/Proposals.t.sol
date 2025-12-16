// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/tables/Proposals.sol";

contract ProposalsTest is Test {
    Proposals proposals;
    Senators senators;
    address user1 = address(0x1);
    address user2 = address(0x2);
    address user3 = address(0x3);
    address user4 = address(0x69420);
    function setUp() public {
        senators = new Senators();
        proposals = new Proposals("Proposals", address(senators), 3, 2);
        address[] memory newSenators = new address[](3);
        newSenators[0] = user1;
        newSenators[1] = user2;
        newSenators[2] = user3;
        senators.addSenators(newSenators);
    }
    function testTempCheckSenator() public {
        vm.startPrank(user1);
        proposals.voteTempCheck(0, true);
        assertEq(proposals.tempCheckApprovalCount(0), 1);
        vm.expectRevert("Already voted");
        proposals.voteTempCheck(0, true);
        proposals.voteTempCheck(0, false);
        assertEq(proposals.tempCheckApprovalCount(0), 0);
        vm.expectRevert("Already voted");
        proposals.voteTempCheck(0, false);
        vm.stopPrank();
    }
    function testTempCheckNonSenator() public {
        vm.startPrank(user4);
        vm.expectRevert("Must be a senator to vote on temp check");
        proposals.voteTempCheck(0, true);
        vm.stopPrank();
    }
    function testTempCheckPasses() public {
        assertEq(proposals.tempCheckApproved(0), false);
        vm.prank(user1);
        proposals.voteTempCheck(0, true);
        vm.prank(user2);
        proposals.voteTempCheck(0, true);
        vm.prank(user3);
        proposals.voteTempCheck(0, true);
        assertEq(proposals.tempCheckApproved(0), true);
    }
    function testTempCheckFails() public {
        assertEq(proposals.tempCheckApproved(0), false);
        vm.prank(user1);
        proposals.voteTempCheck(0, true);
        vm.prank(user2);
        proposals.voteTempCheck(0, false);
        vm.prank(user3);
        proposals.voteTempCheck(0, false);
        assertEq(proposals.tempCheckFailed(0), true);
    }
}

