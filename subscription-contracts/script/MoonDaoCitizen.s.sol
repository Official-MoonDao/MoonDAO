// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Script.sol";
// import "../src/tables/MoonDaoTableland.sol";
import {MoonDAOCitizenTable} from "../src/tables/CitizenTableV2.sol";
import "../src/ERC5643Citizen.sol";
import {CitizenRowController} from "../src/tables/CitizenRowController.sol";
import {Whitelist} from "../src/Whitelist.sol";

contract MyScript is Script {
    function run() external {
        address TREASURY = 0xAF26a002d716508b7e375f1f620338442F5470c0;

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        Whitelist whitelist = new Whitelist();

        Whitelist discountList = new Whitelist();

        MoonDAOCitizenTable citizenTable  = new MoonDAOCitizenTable("CITIZENTABLE");

        MoonDAOCitizen citizen = new MoonDAOCitizen("MoonDaoCitizen", "MDC", TREASURY, address(citizenTable), address(whitelist), address(discountList));

        citizen.setOpenAccess(true);

        CitizenRowController citizenRowController = new CitizenRowController(address(citizenTable));

        citizenRowController.addTableOwner(address(citizen));

        citizenTable.setAccessControl(address(citizenRowController));

        citizenTable.setCitizenAddress(address(citizen));

        string[] memory attributes = new string[](8);
        attributes[0] = "location";
        attributes[1] = "discord";
        attributes[2] = "twitter";
        attributes[3] = "instagram";
        attributes[4] = "linkedin";
        attributes[5] = "website";
        attributes[6] = "view";
        attributes[7] = "formId";

        string memory uriTemplate = citizenTable.generateURITemplate(attributes);
        citizen.setURITemplate(uriTemplate);

        vm.stopBroadcast();
    }
}
