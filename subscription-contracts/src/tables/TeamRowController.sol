pragma solidity ^0.8.20;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {SQLHelpers} from "@evm-tableland/contracts/utils/SQLHelpers.sol";
import {TablelandController} from "@evm-tableland/contracts/TablelandController.sol";
import {TablelandPolicy} from "@evm-tableland/contracts/TablelandPolicy.sol";
import {Policies} from "@evm-tableland/contracts/policies/Policies.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TeamRowController is TablelandController, Ownable {
  address[] private _tableOwners;
  // Set the table owner during contract deployment
    constructor(address tableOwner) Ownable(msg.sender) {
        _tableOwners.push(tableOwner);
    }

    function addTableOwner(address tableOwner) public onlyOwner {
        _tableOwners.push(tableOwner);
    }

    function removeTableOwner(address tableOwner) public onlyOwner {
        for (uint256 i = 0; i < _tableOwners.length; i++) {
            if (tableOwner == _tableOwners[i]) {
                _tableOwners[i] = _tableOwners[_tableOwners.length - 1];
                _tableOwners.pop();
                break;
            }
        }
    }

    function isTableOnwer(address caller) internal view returns (bool) {
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

        // Restrict updates to a single `val` column
        string[] memory updatableColumns = new string[](1);
        updatableColumns[0] = "metadata";

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