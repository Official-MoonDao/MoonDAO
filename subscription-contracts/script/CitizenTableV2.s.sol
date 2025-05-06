pragma solidity ^0.8.20;

/*
1. Run script
2. citizen.setUriTemplate();
*/

import "forge-std/Script.sol";
import "../src/tables/CitizenTableV2.sol";
import {CitizenRowController} from "../src/tables/CitizenRowController.sol";
contract MyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address CITIZEN_ADDRESS = 0x6E464F19e0fEF3DB0f3eF9FD3DA91A297DbFE002;

        MoonDAOCitizenTable citizenTable = new MoonDAOCitizenTable("CITIZENTABLE");
        citizenTable.setCitizenAddress(CITIZEN_ADDRESS);

        CitizenRowController citizenRowController = new CitizenRowController(address(citizenTable));

        citizenRowController.addTableOwner(CITIZEN_ADDRESS);

        citizenTable.setAccessControl(address(citizenRowController));

        vm.stopBroadcast();
    }
}