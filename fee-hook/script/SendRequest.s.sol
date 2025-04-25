pragma solidity ^0.8.20;

import "forge-std/console.sol";
import "forge-std/Script.sol";
import "../src/FeeHook.sol";
import {Config} from "./base/Config.sol";

contract MyScript is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address payable hookAddress = payable(FEE_HOOK_ADDRESSES[block.chainid]);
        FeeHook feeHook = FeeHook(hookAddress);
        string[] memory args = new string[](1);
        args[0] = "0x08B3e694caA2F1fcF8eF71095CED1326f3454B89";
        bytes32 requestId = feeHook.sendRequest(CHAINLINK_SUBS[block.chainid], args);
        console.logBytes32(requestId);

        vm.stopBroadcast();
    }
}


