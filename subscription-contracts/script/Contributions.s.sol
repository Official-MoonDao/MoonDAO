// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {Contributions} from "../src/tables/Contributions.sol";

/// @notice Deploys the contributions table and gives it to the payout Safe.
///
/// `closeCycle` and `recordResults` are owner-only. A cron job run by an
/// operator wallet proposes those calls (plus the payments) to ADMIN_SAFE.
/// Signers execute the batch; nothing is recorded or paid before that.
/// OPERATOR, when set, may hide a row without a Safe transaction.
///
/// The cap is 5 submissions per citizen per cycle.
///
///   CITIZEN_NFT=0x... ADMIN_SAFE=0x... [OPERATOR=0x...] \
///   forge script script/Contributions.s.sol --rpc-url $RPC_URL --broadcast --verify
///
/// Citizen NFT: Arbitrum 0x6E464F19e0fEF3DB0f3eF9FD3DA91A297DbFE002,
/// Sepolia 0x48A0E8B6a86a05aeA3C544B7A9916F6FaFb88d8a.
/// After deploy, fill CONTRIBUTIONS_ADDRESSES and CONTRIBUTIONS_TABLE_NAMES
/// in ui/const/config.ts. The table name is logged below.
contract DeployContributions is Script {
    uint256 internal constant MAX_PER_CYCLE = 5;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address citizen = vm.envAddress("CITIZEN_NFT");
        address safe = vm.envAddress("ADMIN_SAFE");
        address operator = vm.envOr("OPERATOR", address(0));

        vm.startBroadcast(pk);

        Contributions contributions = new Contributions("CONTRIBUTIONS", citizen, MAX_PER_CYCLE);
        if (operator != address(0)) {
            contributions.setOperator(operator, true);
        }
        contributions.transferOwnership(safe);

        vm.stopBroadcast();

        console.log("Contributions:", address(contributions));
        console.log("Owner (payout Safe):", safe);
        console.log("Table:", contributions.getTableName());
    }
}
