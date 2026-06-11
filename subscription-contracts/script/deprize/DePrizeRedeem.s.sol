// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {DePrizeRedeem} from "../../src/deprize/DePrizeRedeem.sol";
import "base/Config.sol";

/// @title DeployDePrizeRedeem
/// @notice Deploys the stateless DePrizeRedeem helper. No proxy — the contract
///         is immutable-only and non-custodial (bettors can always bypass it and
///         call the CTF directly), so there is nothing to upgrade.
///
/// Usage (arbitrum-sepolia):
///   DEPRIZE_REGISTRY=0x<registryProxy> \
///   forge script script/deprize/DePrizeRedeem.s.sol \
///     --rpc-url $ARB_SEPOLIA_RPC --via-ir --optimizer-runs 200 --broadcast
contract DeployDePrizeRedeem is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address registry = vm.envAddress("DEPRIZE_REGISTRY");

        address weth = WETH_ADDRESSES[block.chainid];
        address ctf = CONDITIONAL_TOKENS_ADDRESSES[block.chainid];
        require(weth != address(0), "WETH not configured for chain");
        require(ctf != address(0), "ConditionalTokens not configured for chain");

        vm.startBroadcast(deployerPrivateKey);
        DePrizeRedeem redeem = new DePrizeRedeem(registry, ctf, weth);
        vm.stopBroadcast();

        console.log("DePrizeRedeem:", address(redeem));
        console.log("  registry:", registry);
        console.log("  ctf:     ", ctf);
        console.log("  weth:    ", weth);
        console.log("Bettors: ctf.setApprovalForAll(redeem, true) once, then redeem(deprizeId).");
    }
}
