// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";

import {Constants} from "./base/Constants.sol";
import { FakeERC20 } from "../src/FakeERC20.sol";
import {Config} from "./base/Config.sol";
import {FeeHook} from "../src/FeeHook.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

interface MissionCreator {
    function setFeeHookAddress(address hookAddress) external;
}

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
        address poolManagerAddress = POOL_MANAGERS[block.chainid];
        address posmAddress = POSITION_MANAGERS[block.chainid];
        address vMooneyAddress = VMOONEY_ADDRESSES[block.chainid];

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(deployerAddress, poolManagerAddress, posmAddress, vMooneyAddress);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(FeeHook).creationCode, constructorArgs);

        // Deploy the hook using CREATE2
        FeeHook feehook = new FeeHook{salt: salt}(deployerAddress, IPoolManager(poolManagerAddress), IPositionManager(posmAddress), vMooneyAddress);
        // Set to a low value for testing
        if (block.chainid == ARB_SEP || block.chainid == SEP) {
            feehook.setMinWithdraw(0.00001 ether);
            uint256 initialSupply = 1000000 * 10**18;  // Adjust the amount you want to mint
            FakeERC20 token0 = new FakeERC20{salt: currentSalt()}(initialSupply, "FakeToken 4", "FAKE4", deployerAddress);
            feehook.setvMooneyAddress(address(token0));
        }
        require(address(feehook) == hookAddress, "Fee hook address mismatch");
        //MissionCreator missionCreator = MissionCreator(MISSION_CREATOR_ADDRESSES[block.chainid]);
        //missionCreator.setFeeHookAddress(address(feehook));
        vm.stopBroadcast();
    }
}
