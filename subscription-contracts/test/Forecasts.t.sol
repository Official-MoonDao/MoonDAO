// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {Forecasts} from "../src/tables/Forecasts.sol";

contract ForecastsTest is Test {
    Forecasts forecasts;
    address owner = address(0x1);
    address stranger = address(0x2);

    function setUp() public {
        vm.prank(owner);
        forecasts = new Forecasts("Forecasts");
    }

    function testOwnerIsWriter() public {
        assertTrue(forecasts.writers(owner));
        assertEq(forecasts.owner(), owner);
    }

    function testStrangerCannotWrite() public {
        vm.prank(stranger);
        vm.expectRevert(Forecasts.NotWriter.selector);
        forecasts.insertRow("arbitrum", 1, "abc", "[0.5,0.5]", "", 1);
    }

    function testOwnerCanAllowWriter() public {
        vm.prank(owner);
        forecasts.setWriter(stranger, true);
        assertTrue(forecasts.writers(stranger));
    }
}
