pragma solidity ^0.8.20;

/*
1. Make sure the citizen row controller is up to date with the citizen table columns
2. Run script
3. citizenTable.setAccessControl(citizenRowController)
*/

import "forge-std/Script.sol";
import {CitizenRowController} from "../src/tables/CitizenRowController.sol";
contract MyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address CITIZEN_ADDRESS = 0xEb9A6975381468E388C33ebeF4089Be86fe31d78;
        address CITIZEN_TABLE_ADDRESS = 0x0000000000000000000000000000000000000000;


        CitizenRowController citizenRowController = new CitizenRowController(CITIZEN_TABLE_ADDRESS);

        citizenRowController.addTableOwner(CITIZEN_ADDRESS);


        vm.stopBroadcast();
    }
}