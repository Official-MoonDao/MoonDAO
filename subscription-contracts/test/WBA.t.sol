// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/ERC5643.sol";
import {WBA} from "../src/tables/WBA.sol";

contract DistributionTest is Test {

    address user1 = address(0x1);
    WBA wba;

    function setUp() public {

      vm.startPrank(user1);

      wba = new WBA("test");
      console.log(address(wba));

      vm.stopPrank();
    }

    function testInsertTable() public {
        wba.insertIntoTable('test distribution 0');
    }
    function testUpdateTable() public {
        wba.updateTableCol('test distribution 1');
    }
    function testDelete() public {
        wba.deleteFromTable();
    }
}

