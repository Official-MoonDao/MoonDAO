pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/FeeHook.sol";
import {Config} from "./base/Config.sol";

/// @notice Script to distribute weekly fees to checked in users
contract DistributeFees is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address payable hookAddress = payable(FEE_HOOK_ADDRESSES[block.chainid]);
        FeeHook feeHook = FeeHook(hookAddress);
        feeHook.distributeFees();

        vm.stopBroadcast();
    }
}
