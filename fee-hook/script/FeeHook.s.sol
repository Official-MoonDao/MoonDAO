// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {FunctionsRouter} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsRouter.sol";

import {Constants} from "./base/Constants.sol";
import {Config} from "./base/Config.sol";
import {FeeHook} from "../src/FeeHook.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

/// @notice Mines the address and deploys the FeeHook.sol Hook contract
contract FeeHookScript is Script, Constants, Config {
    function setUp() public {}

    function run() public {
        // hook contracts must have specific flags encoded in the address
        uint160 flags = uint160(
            Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);
        address lzEndpoint = LZ_ENDPOINTS[block.chainid];
        address chainlinkRouter = CHAINLINK_ROUTERS[block.chainid];
        address poolManagerAddress = POOL_MANAGERS[block.chainid];
        address posmAddress = POSITION_MANAGERS[block.chainid];
        bytes32 donID = CHAINLINK_DONS[block.chainid];
        uint64 subscriptionId = CHAINLINK_SUBS[block.chainid];
        address vMooneyAddress = VMOONEY_ADDRESSES[block.chainid];
        // Sepolia for testnets, arbitrum for mainnet
        uint256 DESTINATION_CHAIN_ID = ARBITRUM;
        uint16 DESTINATION_EID = uint16(LZ_EIDS[ARBITRUM]);
        if (block.chainid == ARB_SEP || block.chainid == SEP) { // test nets
            DESTINATION_CHAIN_ID = SEP;
            DESTINATION_EID = uint16(LZ_EIDS[SEP]);
        }

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(deployerAddress, poolManagerAddress, posmAddress, lzEndpoint, DESTINATION_CHAIN_ID, DESTINATION_EID, vMooneyAddress, chainlinkRouter, donID, subscriptionId);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(FeeHook).creationCode, constructorArgs);

        // Deploy the hook using CREATE2
        FeeHook feehook = new FeeHook{salt: salt}(deployerAddress, IPoolManager(poolManagerAddress), IPositionManager(posmAddress), lzEndpoint, DESTINATION_CHAIN_ID, DESTINATION_EID, vMooneyAddress, chainlinkRouter, donID, subscriptionId);
        // Set to a low value for testing
        if (block.chainid == ARB_SEP || block.chainid == SEP) {
            feehook.setMinWithdraw(0.00001 ether);
        }
        FunctionsRouter chainlinkRouterContract = FunctionsRouter(chainlinkRouter);
        chainlinkRouterContract.addConsumer(CHAINLINK_SUBS[block.chainid], address(feehook));

        require(address(feehook) == hookAddress, "Fee hook address mismatch");
        vm.stopBroadcast();
    }
}
