// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";
import "base/Config.sol";

/// @title DeployDePrizeMint
/// @notice Deploys the DePrizeMint bet-router behind a UUPS (ERC1967) proxy and
///         initializes it against the DePrizeRegistry, the shared Juicebox V5
///         terminal, and the chain's WETH + Conditional Tokens deployments.
///
/// The DePrizeRegistry proxy address must be provided via the DEPRIZE_REGISTRY
/// env var. Per-DePrize markets are wired afterwards with `setMarket` once the
/// prediction-market provisioning migration has created them.
///
/// Usage (arbitrum-sepolia):
///   DEPRIZE_REGISTRY=0x<registryProxy> \
///   forge script script/deprize/DePrizeMint.s.sol \
///     --rpc-url $ARB_SEPOLIA_RPC --via-ir --optimizer-runs 200 --broadcast
contract DeployDePrizeMint is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("DEPRIZE_OWNER", vm.addr(deployerPrivateKey));
        address registry = vm.envAddress("DEPRIZE_REGISTRY");

        address weth = WETH_ADDRESSES[block.chainid];
        address ctf = CONDITIONAL_TOKENS_ADDRESSES[block.chainid];
        require(weth != address(0), "WETH not configured for chain");
        require(ctf != address(0), "ConditionalTokens not configured for chain");

        vm.startBroadcast(deployerPrivateKey);

        DePrizeMint impl = new DePrizeMint();
        bytes memory initData =
            abi.encodeCall(DePrizeMint.initialize, (owner, registry, JB_V5_MULTI_TERMINAL, weth, ctf));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        vm.stopBroadcast();

        console.log("DePrizeMint implementation:", address(impl));
        console.log("DePrizeMint proxy:         ", address(proxy));
        console.log("  owner:    ", owner);
        console.log("  registry: ", registry);
        console.log("  terminal: ", JB_V5_MULTI_TERMINAL);
        console.log("  weth:     ", weth);
        console.log("  ctf:      ", ctf);
        console.log("Next: deprizeMint.setMarket(deprizeId, lmsrMarket) per DePrize.");
    }
}
