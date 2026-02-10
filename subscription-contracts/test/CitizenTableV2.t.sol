// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/tables/CitizenTableV2.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// Mock ERC721 to simulate citizen NFT ownership
contract MockCitizenNFT is ERC721 {
    constructor() ERC721("MockCitizen", "MCTZ") {}

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}

contract MoonDAOCitizenTableTest is Test {
    MoonDAOCitizenTable private moonDAOCitizenTable;
    MockCitizenNFT private mockCitizenNFT;
    address private owner = address(0x123);
    address private citizenOwner = address(0x456);
    address private attacker = address(0x789);

    function setUp() public {
        vm.startPrank(owner);
        moonDAOCitizenTable = new MoonDAOCitizenTable("CITIZENTABLEV2");
        mockCitizenNFT = new MockCitizenNFT();
        moonDAOCitizenTable.setCitizenAddress(address(mockCitizenNFT));
        vm.stopPrank();

        // Mint citizen NFT #1 to citizenOwner
        mockCitizenNFT.mint(citizenOwner, 1);
    }

    function testAddMultipleColumns() public {
        vm.startPrank(owner);

        moonDAOCitizenTable.addColumn("newColumn1", "text");
        moonDAOCitizenTable.addColumn("newColumn2", "text");

        vm.stopPrank();
    }

    function testDynamicUpdateAsOwner() public {
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

    function testDynamicUpdateAsCitizenOwner() public {
        vm.startPrank(citizenOwner);

        string[] memory columns = new string[](2);
        columns[0] = "name";
        columns[1] = "description";

        string[] memory updateValues = new string[](2);
        updateValues[0] = "My Name";
        updateValues[1] = "My Bio";

        moonDAOCitizenTable.updateTableDynamic(1, columns, updateValues);

        vm.stopPrank();
    }

    function testDynamicUpdateRevertsForUnauthorizedUser() public {
        vm.startPrank(attacker);

        string[] memory columns = new string[](1);
        columns[0] = "name";

        string[] memory updateValues = new string[](1);
        updateValues[0] = "HACKED";

        vm.expectRevert("Only Admin, Citizen contract, or Citizen owner can update");
        moonDAOCitizenTable.updateTableDynamic(1, columns, updateValues);

        vm.stopPrank();
    }

    function testDeleteFromTableRevertsForUnauthorizedUser() public {
        vm.startPrank(attacker);

        vm.expectRevert("Only Admin, Citizen contract, or Citizen owner can delete");
        moonDAOCitizenTable.deleteFromTable(1);

        vm.stopPrank();
    }

    function testDeleteFromTableAsOwner() public {
        vm.startPrank(owner);
        moonDAOCitizenTable.deleteFromTable(1);
        vm.stopPrank();
    }

    function testDeleteFromTableAsCitizenOwner() public {
        vm.startPrank(citizenOwner);
        moonDAOCitizenTable.deleteFromTable(1);
        vm.stopPrank();
    }

    function testDeleteColumn() public {
        vm.startPrank(owner);

        moonDAOCitizenTable.deleteColumn("newColumn1");

        vm.stopPrank();
    }
}
