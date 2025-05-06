// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/tables/CitizenTableV2.sol";

contract MoonDAOCitizenTableTest is Test {
    MoonDAOCitizenTable private moonDAOCitizenTable;
    address private owner = address(0x123);

    function setUp() public {
        vm.startPrank(owner);
        moonDAOCitizenTable = new MoonDAOCitizenTable("CITIZENTABLEV2");
        vm.stopPrank();
    }

    function testAddMultipleColumns() public {
        vm.startPrank(owner);

        moonDAOCitizenTable.addColumn("newColumn1", "text");
        moonDAOCitizenTable.addColumn("newColumn2", "text");

        vm.stopPrank();
    }

    function testDynamicUpdate() public {
        vm.startPrank(owner);

        string[] memory columns = new string[](2);
        columns[0] = "newColumn1";
        columns[1] = "newColumn2";

        string[] memory updateValues = new string[](2);
        updateValues[0] = "updatedValue1";
        updateValues[1] = "updatedValue2";

         moonDAOCitizenTable.updateTableDynamic(1, columns, updateValues);
    
        vm.stopPrank();
    }

    function testDeleteColumn() public {
        vm.startPrank(owner);

        moonDAOCitizenTable.deleteColumn("newColumn1");

        vm.stopPrank();
    }
}
