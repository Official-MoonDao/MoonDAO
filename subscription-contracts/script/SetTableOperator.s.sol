// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/tables/JobBoardTable.sol";
import "../src/tables/MarketplaceTable.sol";

// Whitelists an operator on the JobBoardTable and MarketplaceTable. The UI's
// project relay (ui/pages/api/project/table-write.ts) writes project jobs and
// listings from the GCP HSM signer, so that signer must be an operator on both.
// Must be broadcast by the tables' owner.
//
// Usage:
//   JOBS_TABLE=0x2113341dEc8a0fB9883Ad494C589d5cdefDDBc1b \
//   MARKETPLACE_TABLE=0xF0AeE0c837943fa1919538B12b5d9AE11C5EED05 \
//   OPERATOR=0xb206325e6562517532686dfeeead4c104d9f5d32 \
//   forge script script/SetTableOperator.s.sol \
//     --rpc-url https://arb1.arbitrum.io/rpc \
//     --broadcast \
//     --private-key $PRIVATE_KEY

contract SetTableOperator is Script {
    function run() external {
        JobBoardTable jobBoard = JobBoardTable(vm.envAddress("JOBS_TABLE"));
        MarketplaceTable marketplace = MarketplaceTable(vm.envAddress("MARKETPLACE_TABLE"));
        address operator = vm.envAddress("OPERATOR");
        bool enabled = vm.envOr("ENABLED", true);

        vm.startBroadcast();
        jobBoard.setOperator(operator, enabled);
        marketplace.setOperator(operator, enabled);
        vm.stopBroadcast();

        require(jobBoard.operators(operator) == enabled, "JobBoardTable operator not set");
        require(marketplace.operators(operator) == enabled, "MarketplaceTable operator not set");
        console.log("Operator", operator, enabled ? "enabled" : "disabled");
    }
}
