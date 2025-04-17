pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/FeeHook.sol";
import {Config} from "./base/Config.sol";

contract MyScript is Script, Config {
    function addressToBytes32(address _addr) public pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        uint32 eid;

        address payable arbAddress = payable(0x0000000000000000000000000000000000000000);
        address payable baseAddress = payable(0x0000000000000000000000000000000000000000);
        address payable hookAddress = payable(getHookAddress(block.chainid));
        if(block.chainid == 1) { //mainnet
            eid = 30101;
        } else if (block.chainid == 42161) { //arbitrum
            uint32 baseEid = 30184;
            FeeHook feeHook = FeeHook(hookAddress);
            feeHook.setPeer(baseEid, addressToBytes32(baseAddress));
            eid = 30110;
        } else if (block.chainid == 8453) { //base
            uint32 arbEid = 30110;
            FeeHook feeHook = FeeHook(hookAddress);
            feeHook.setPeer(arbEid, addressToBytes32(arbAddress));
            eid = 30184;
        } else if (block.chainid == 421614) { //arb-sep
            eid = 40231;
            // testing arb-sep -> sep
            uint32 sepEid = 40161;
            FeeHook feeHook = FeeHook(hookAddress);
            address sepAddress = getHookAddress(11155111);
            feeHook.setPeer(sepEid, addressToBytes32(sepAddress));
        } else if (block.chainid == 11155111) { //sep
            eid = 40161;
            // sep -> arb-sep
            uint32 arbSepEid = 40231;
            FeeHook feeHook = FeeHook(hookAddress);
            address arbSepAddress = getHookAddress(421614);
            feeHook.setPeer(arbSepEid, addressToBytes32(arbSepAddress));
        }



        vm.stopBroadcast();
    }
}

