pragma solidity ^0.8.20;

/*
1. Make sure the citizen row controller is up to date with the citizen table columns
2. Run script
3. citizenTable.setAccessControl(citizenRowController)
*/

import "forge-std/Script.sol";
import {CitizenRowController} from "../src/tables/CitizenRowController.sol";
import { Config } from "base/Config.sol";

contract MyScript is Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address CITIZEN_NFT_ADDRESS = CITIZEN_NFT_ADDRESSES[block.chainid];
        address CITIZEN_TABLE_ADDRESS = CITIZEN_TABLE_ADDRESSES[block.chainid];

        CitizenRowController citizenRowController = new CitizenRowController(CITIZEN_TABLE_ADDRESS);
        // This is created needs to be set on the contract once deployed (multisig txn)
        citizenRowController.addTableOwner(CITIZEN_NFT_ADDRESS);

        vm.stopBroadcast();
    }
}