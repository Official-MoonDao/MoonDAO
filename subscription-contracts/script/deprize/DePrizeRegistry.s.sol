// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";

/// @title DeployDePrizeRegistry
/// @notice Deploys the immutable DePrizeRegistry v2 owned by `DEPRIZE_OWNER`
///         (the admin Safe). No proxy, no initializer, nothing to upgrade.
///
/// Usage:
///   DEPRIZE_OWNER=0x<admin-safe> \
///   forge script script/deprize/DePrizeRegistry.s.sol \
///     --rpc-url $RPC --via-ir --optimizer-runs 200 --broadcast
contract DeployDePrizeRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.envAddress("DEPRIZE_OWNER");
        require(owner != address(0), "DEPRIZE_OWNER is zero");

        vm.startBroadcast(deployerPrivateKey);
        DePrizeRegistry registry = new DePrizeRegistry(owner);
        vm.stopBroadcast();

        require(registry.owner() == owner, "owner mismatch");
        console.log("DePrizeRegistry:", address(registry));
        console.log("  owner:        ", owner);
        console.log("RECORD this address - it is DEPRIZE_REGISTRY for later scripts.");
    }
}
