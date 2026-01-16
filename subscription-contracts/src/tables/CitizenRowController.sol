pragma solidity ^0.8.20;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {SQLHelpers} from "@evm-tableland/contracts/utils/SQLHelpers.sol";
import {TablelandController} from "@evm-tableland/contracts/TablelandController.sol";
import {TablelandPolicy} from "@evm-tableland/contracts/TablelandPolicy.sol";
import {Policies} from "@evm-tableland/contracts/policies/Policies.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
// import {MoonDAOCitizen} from "../ERC5643Citizen.sol";

contract CitizenRowController is TablelandController, Ownable {
  address[] public _tableOwners;
//   MoonDAOCitizen private _citizenERC5643;

    // Set the table owner during contract deployment
    constructor(address tableOwner) Ownable(msg.sender) {
        _tableOwners.push(tableOwner);
        // _citizenERC5643 = MoonDAOCitizen(citizenERC5643);
    }

    // add a new table owner
    function addTableOwner(address tableOwner) public onlyOwner {
        _tableOwners.push(tableOwner);
    }

    // remove a table owner
    function removeTableOwner(address tableOwner) public onlyOwner {
        for (uint256 i = 0; i < _tableOwners.length; i++) {
            if (tableOwner == _tableOwners[i]) {
                _tableOwners[i] = _tableOwners[_tableOwners.length - 1];
                _tableOwners.pop();
                break;
            }
        }
    }

    function isTableOnwer(address caller) public view returns (bool) {
        // Ensure the caller is the table owner
        bool isTableOwner = false;
        for (uint256 i = 0; i < _tableOwners.length; i++) {
            if (caller == _tableOwners[i]) {
                isTableOwner = true;
                break;
            }
        }
        return isTableOwner;
    }

    function getPolicy(
        address caller,
        uint256
    ) public payable override returns (TablelandPolicy memory) {

        // Return allow-all policy if the caller is the owner—our `Example` contract
        if (isTableOnwer(caller)) {
            return
                TablelandPolicy({
                    allowInsert: true,
                    allowUpdate: true,
                    allowDelete: true,
                    whereClause: "",
                    withCheck: "",
                    updatableColumns: new string[](0)
                });
        }

        // For all others, we'll have controls on the update
        // First, establish WHERE clauses (i.e., where the address is the caller)
        string[] memory whereClause = new string[](1);
        whereClause[0] = string.concat(
            "owner=",
            SQLHelpers.quote(Strings.toHexString(caller))
        );


        string[] memory updatableColumns = new string[](12);
        // string[12] memory updatableColumns = ["name", "description", "image", "location", "discord", "twitter", "website", "instagram", "linkedin", "view", "formId", "owner"];
        updatableColumns[0] = "name";
        updatableColumns[1] = "description";
        updatableColumns[2] = "image";
        updatableColumns[3] = "location";
        updatableColumns[4] = "discord";
        updatableColumns[5] = "twitter";
        updatableColumns[6] = "website";
        updatableColumns[7] = "instagram";
        updatableColumns[8] = "linkedin";
        updatableColumns[9] = "view";
        updatableColumns[10] = "formId";
        updatableColumns[11] = "owner";

        // Now, return the policy that gates by the WHERE clause & updatable columns
        return
            TablelandPolicy({
                allowInsert: false,
                allowUpdate: true,
                allowDelete: false,
                whereClause: Policies.joinClauses(whereClause),
                withCheck: "",
                updatableColumns: updatableColumns
            });
    }
}