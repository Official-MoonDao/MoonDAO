// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/ERC5643.sol";
import {Votes} from "../src/tables/Votes.sol";

contract VotesTest is Test {

    address user1 = address(0x1);
    Votes votes;

    function setUp() public {

      vm.startPrank(user1);

      votes = new Votes("test");

      vm.stopPrank();
    }

    function testInsertTable() public {
        votes.insertIntoTable(0, 'test distribution 0');
    }
    function testUpdateTable() public {
        votes.updateTableCol(0, 'test distribution 1');
    }
    function testDelete() public {
        votes.deleteFromTable(0);
    }
}

