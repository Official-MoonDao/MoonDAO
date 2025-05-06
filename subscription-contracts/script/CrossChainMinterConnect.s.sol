pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/CrossChainMinter.sol";

contract MyScript is Script {



    function addressToBytes32(address _addr) public pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        uint32 eid;

        address arbSepAddress = 0x77E5c79341eeE988634caa5B28C16638F1Eb91E1;
        address sepAddress = 0x6f80846e64931731Fcb3c24c9902b20af864882f;
        address arbAddress = 0x613B64AE4A5f5354bA15c9e5c988A6A32c14b6da;
        address baseAddress = 0xe5709Bc44427DCEF81fF2F718DFc6A032fD23bbF;
        if(block.chainid == 1) { //mainnet
            eid = 30101;
        } else if (block.chainid == 42161) { //arbitrum
            uint32 baseEid = 30184;
            CrossChainMinter minter = CrossChainMinter(arbAddress);
            minter.setPeer(baseEid , addressToBytes32(baseAddress));
            eid = 30110;
        } else if (block.chainid == 8453) { //base
            uint32 arbEid = 30110;
            CrossChainMinter minter = CrossChainMinter(baseAddress);
            minter.setPeer(arbEid , addressToBytes32(arbAddress));
            eid = 30184;
        } else if (block.chainid == 421614) { //arb-sep
            eid = 40231;
            // testing arb-sep -> sep
            uint32 sepEid = 40161;
            CrossChainMinter minter = CrossChainMinter(arbSepAddress);
            minter.setPeer(sepEid , addressToBytes32(sepAddress));
        } else if (block.chainid == 11155111) { //sep
            eid = 40161;
            // sep -> arb-sep
            uint32 arbSepEid = 40231;
            CrossChainMinter minter = CrossChainMinter(sepAddress);
            minter.setPeer(arbSepEid , addressToBytes32(arbSepAddress));
        }



        vm.stopBroadcast();
    }
}
