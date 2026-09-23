// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {Forecasts} from "../src/tables/Forecasts.sol";

contract ForecastsTest is Test {
    address user1 = address(0x1);
    Forecasts forecasts;

    function setUp() public {
        vm.startPrank(user1);

        forecasts = new Forecasts("test");

        vm.stopPrank();
    }

    function testInsertTable() public {
        forecasts.insertIntoTable(0, "test distribution 0");
    }

    function testUpdateTable() public {
        forecasts.updateTableCol(0, "test distribution 1");
    }

    function testDelete() public {
        forecasts.deleteFromTable(0);
    }
}
