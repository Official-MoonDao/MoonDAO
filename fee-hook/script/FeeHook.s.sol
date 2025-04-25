// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";

import {Constants} from "./base/Constants.sol";
import {Config} from "./base/Config.sol";
import {FeeHook} from "../src/FeeHook.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

/// @notice Mines the address and deploys the Counter.sol Hook contract
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
        address posmAddress = POOL_MANAGERS[block.chainid];
        bytes32 donID = CHAINLINK_DONS[block.chainid];
        address vMooneyAddress = 0xB255c74F8576f18357cE6184DA033c6d93C71899;
        // Sepolia for testnets, arbitrum for mainnet
        uint256 DESTINATION_CHAIN_ID = 42161;
        uint16 DESTINATION_EID = 30110;
        // Addresses from https://docs.uniswap.org/contracts/v4/deployments
        if(block.chainid == 1) { //mainnet
        } else if (block.chainid == 42161) { //arbitrum
        } else if (block.chainid == 8453) { //base
        } else if (block.chainid == 421614) { //arb-sep
            vMooneyAddress = 0xA4F6A4B135b9AF7909442A7a3bF7797b61e609b1;
            DESTINATION_CHAIN_ID = 11155111;
            DESTINATION_EID = 40161;
        } else if (block.chainid == 11155111) { //sep
            vMooneyAddress = 0xA4F6A4B135b9AF7909442A7a3bF7797b61e609b1;
            DESTINATION_CHAIN_ID = 11155111;
            DESTINATION_EID = 40161;
        }

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(deployerAddress, poolManagerAddress, posmAddress, lzEndpoint, DESTINATION_CHAIN_ID, DESTINATION_EID, vMooneyAddress, chainlinkRouter, donID);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(FeeHook).creationCode, constructorArgs);

        // Deploy the hook using CREATE2
        FeeHook feehook = new FeeHook{salt: salt}(deployerAddress, IPoolManager(poolManagerAddress), IPositionManager(posmAddress), lzEndpoint, DESTINATION_CHAIN_ID, DESTINATION_EID, vMooneyAddress, chainlinkRouter, donID);
        // Set to a low value for testing
        if (block.chainid == 421614 || block.chainid == 11155111) {
            feehook.setMinWithdraw(0.00001 ether);
        }
        require(address(feehook) == hookAddress, "CounterScript: hook address mismatch");
        vm.stopBroadcast();
    }
}
