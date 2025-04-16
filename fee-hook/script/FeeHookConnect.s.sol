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

        address payable arbAddress = payable(0x0000000000000000000000000000000000000000);
        address payable baseAddress = payable(0x0000000000000000000000000000000000000000);
        address payable hookAddress = payable(HOOK_ADDRESSES[block.chainid]);
        FeeHook feeHook = FeeHook(hookAddress);
        if(block.chainid == 1) { //mainnet
        } else if (block.chainid == ARBITRUM) { //arbitrum
            uint32 baseEid = LZ_EIDS[BASE];
            feeHook.setPeer(baseEid, addressToBytes32(baseAddress));
        } else if (block.chainid == BASE) { //base
            uint32 arbEid = LZ_EIDS[ARBITRUM];
            feeHook.setPeer(arbEid, addressToBytes32(arbAddress));
        } else if (block.chainid == ARB_SEP) { //arb-sep
            // testing arb-sep -> sep
            uint32 sepEid = LZ_EIDS[SEP];
            address sepAddress = HOOK_ADDRESSES[SEP];
            feeHook.setPeer(sepEid, addressToBytes32(sepAddress));
        } else if (block.chainid == SEP) { //sep
            // sep -> arb-sep
            uint32 arbSepEid = LZ_EIDS[ARB_SEP];
            address arbSepAddress = HOOK_ADDRESSES[ARB_SEP];
            feeHook.setPeer(arbSepEid, addressToBytes32(arbSepAddress));
        }



        vm.stopBroadcast();
    }
}

