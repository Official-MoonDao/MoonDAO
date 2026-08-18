// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";

/// @title DeployDePrizeRegistry
/// @notice Deploys the current DePrizeRegistry implementation behind a UUPS
///         (ERC1967) proxy and initializes the owner. This is the missing
///         standalone deploy path — Sepolia's proxy was created ad hoc; only
///         `DePrizeRegistryUpgrade.s.sol` existed before.
///
/// AUDIT[plan 1.1]: deploys whatever `src/deprize/DePrizeRegistry.sol` is on
/// this branch (M5 `providerPayoutAddress` + later fields). Do NOT deploy an
/// older impl and upgrade later on mainnet.
///
/// Usage:
///   DEPRIZE_OWNER=0x<admin-safe> \
///   forge script script/deprize/DePrizeRegistry.s.sol \
///     --rpc-url $RPC --via-ir --optimizer-runs 200 --broadcast
contract DeployDePrizeRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("DEPRIZE_OWNER", vm.addr(deployerPrivateKey));
        require(owner != address(0), "DEPRIZE_OWNER is zero");

        vm.startBroadcast(deployerPrivateKey);
        DePrizeRegistry impl = new DePrizeRegistry();
        bytes memory initData = abi.encodeCall(DePrizeRegistry.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        vm.stopBroadcast();

        console.log("DePrizeRegistry implementation:", address(impl));
        console.log("DePrizeRegistry proxy:         ", address(proxy));
        console.log("  owner (initialize):          ", owner);
        console.log("RECORD the proxy - this is DEPRIZE_REGISTRY for later scripts.");
        console.log("Confirm owner() == DEPRIZE_OWNER on-chain before Phase 5.");
    }
}
