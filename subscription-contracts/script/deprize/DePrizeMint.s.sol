// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";
import "base/Config.sol";

/// @title DeployDePrizeMint
/// @notice Deploys the immutable DePrizeMint v2 bet router against the
///         DePrizeRegistry, the shared Juicebox V5 terminal, and the chain's
///         WETH + Conditional Tokens deployments. Owner is `DEPRIZE_OWNER`
///         (the admin Safe), which later calls `setMarket` (write-once per
///         DePrize) and `setComplianceSigner`.
///
/// Usage:
///   DEPRIZE_OWNER=0x<admin-safe> DEPRIZE_REGISTRY=0x<registry> \
///   forge script script/deprize/DePrizeMint.s.sol \
///     --rpc-url $RPC --via-ir --optimizer-runs 200 --broadcast
contract DeployDePrizeMint is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.envAddress("DEPRIZE_OWNER");
        address registry = vm.envAddress("DEPRIZE_REGISTRY");
        require(owner != address(0), "DEPRIZE_OWNER is zero");

        // Chain-id in the revert so a 42161 run cannot deploy against address(0) WETH/CTF.
        (address weth, address ctf) = requireDePrizeCollateral(block.chainid);

        vm.startBroadcast(deployerPrivateKey);
        DePrizeMint mint = new DePrizeMint(owner, registry, JB_V5_MULTI_TERMINAL, weth, ctf);
        vm.stopBroadcast();

        require(mint.owner() == owner, "owner mismatch");
        console.log("DePrizeMint:", address(mint));
        console.log("  owner:    ", owner);
        console.log("  registry: ", registry);
        console.log("  terminal: ", JB_V5_MULTI_TERMINAL);
        console.log("  weth:     ", weth);
        console.log("  ctf:      ", ctf);
        console.log("Next: DePrizeWire (setMarket + setComplianceSigner from the Safe).");
    }
}
