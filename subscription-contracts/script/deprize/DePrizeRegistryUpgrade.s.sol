// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";

/// @title UpgradeDePrizeRegistry
/// @notice Deploys a new DePrizeRegistry implementation (M5 adds the
///         `providerPayoutAddress` mapping in a previously-reserved gap slot, so
///         the storage layout stays compatible) and wires it into the existing
///         UUPS proxy.
///
/// The M5 storage addition is append-only: the new `_providerPayoutAddress`
/// mapping consumes one of the registry's reserved gap slots, leaving every
/// existing slot untouched, so this is a safe in-place upgrade.
///
/// On mainnet the proxy owner is the admin Safe, so this script deploys the new
/// implementation and prints the `upgradeToAndCall(newImpl, "")` calldata for the
/// Safe to submit. On a testnet where the deployer owns the proxy, set
/// DEPRIZE_DO_UPGRADE=true to also broadcast the upgrade directly.
///
/// Usage:
///   DEPRIZE_REGISTRY=0x<registryProxy> [DEPRIZE_DO_UPGRADE=true] \
///   forge script script/deprize/DePrizeRegistryUpgrade.s.sol \
///     --rpc-url $RPC --via-ir --optimizer-runs 200 --broadcast
contract UpgradeDePrizeRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxy = vm.envAddress("DEPRIZE_REGISTRY");
        bool doUpgrade = vm.envOr("DEPRIZE_DO_UPGRADE", false);

        vm.startBroadcast(deployerPrivateKey);

        DePrizeRegistry newImpl = new DePrizeRegistry();

        bytes memory upgradeCall = abi.encodeCall(DePrizeRegistry(proxy).upgradeToAndCall, (address(newImpl), ""));

        if (doUpgrade) {
            DePrizeRegistry(proxy).upgradeToAndCall(address(newImpl), "");
        }

        vm.stopBroadcast();

        console.log("DePrizeRegistry new implementation:", address(newImpl));
        console.log("Proxy:                             ", proxy);
        if (doUpgrade) {
            console.log("Upgrade broadcast: done (deployer is the proxy owner).");
        } else {
            console.log("Upgrade NOT broadcast. Submit this from the proxy owner (Safe):");
            console.log("  to:   ", proxy);
            console.log("  value: 0");
            console.log("  data:");
            console.logBytes(upgradeCall);
        }
    }
}
