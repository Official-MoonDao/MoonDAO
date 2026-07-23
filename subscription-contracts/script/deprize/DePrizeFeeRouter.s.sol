// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {DePrizeFeeRouter} from "../../src/deprize/DePrizeFeeRouter.sol";
import "base/Config.sol";

/// @title DeployDePrizeFeeRouter
/// @notice Deploys the DePrizeFeeRouter (non-upgradeable) against the registry,
///         the shared Juicebox V5 terminal, and the chain's WETH + CTF.
///
/// After deploying, per DePrize (owner/Safe transactions):
///   1. lmsr.transferOwnership(router)   — the router must own the market for
///      withdrawFees to work (if the market is currently owned by the Safe,
///      submit this from the Safe; if provisioned by migration 08, the oracle
///      multisig owns it).
///   2. router.setMarket(deprizeId, lmsr)
///   3. deprizeMint.setFeeRouter(router) — auto-sweep on every bet.
/// Sells hit the LMSR directly, so the UI (or anyone — sweepFees is
/// permissionless) triggers a sweep after sells.
///
/// Usage:
///   DEPRIZE_REGISTRY=0x<registryProxy> \
///   forge script script/deprize/DePrizeFeeRouter.s.sol \
///     --rpc-url $RPC --via-ir --optimizer-runs 200 --broadcast
contract DeployDePrizeFeeRouter is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("DEPRIZE_OWNER", vm.addr(deployerPrivateKey));
        address registry = vm.envAddress("DEPRIZE_REGISTRY");

        address weth = WETH_ADDRESSES[block.chainid];
        address ctf = CONDITIONAL_TOKENS_ADDRESSES[block.chainid];
        require(weth != address(0), "WETH not configured for chain");
        require(ctf != address(0), "ConditionalTokens not configured for chain");

        vm.startBroadcast(deployerPrivateKey);
        DePrizeFeeRouter router = new DePrizeFeeRouter(owner, registry, JB_V5_MULTI_TERMINAL, weth, ctf);
        vm.stopBroadcast();

        console.log("DePrizeFeeRouter:", address(router));
        console.log("  owner:    ", owner);
        console.log("  registry: ", registry);
        console.log("  terminal: ", JB_V5_MULTI_TERMINAL);
        console.log("  weth:     ", weth);
        console.log("  ctf:      ", ctf);
        console.log("Next, per DePrize:");
        console.log("  lmsr.transferOwnership(router)");
        console.log("  router.setMarket(deprizeId, lmsr)");
        console.log("  deprizeMint.setFeeRouter(router)");
    }
}
