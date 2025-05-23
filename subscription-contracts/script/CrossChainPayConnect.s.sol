pragma solidity ^0.8.20;

import "../src/CrossChainPay.sol";
import "base/Config.sol";

contract MyScript is Script, Config {
    function addressToBytes32(address _addr) public pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        CrossChainPay pay = CrossChainPay(payable(CROSS_CHAIN_PAY_ADDRESS));
        if(block.chainid == MAINNET) { //mainnet
            pay.setPeer(LZ_EIDS[ARBITRUM], addressToBytes32(CROSS_CHAIN_PAY_ADDRESS));
        } else if (block.chainid == ARBITRUM) { //arbitrum
            pay.setPeer(LZ_EIDS[BASE], addressToBytes32(CROSS_CHAIN_PAY_ADDRESS));
            pay.setPeer(LZ_EIDS[MAINNET], addressToBytes32(CROSS_CHAIN_PAY_ADDRESS));
        } else if (block.chainid == BASE) { //base
            pay.setPeer(LZ_EIDS[ARBITRUM], addressToBytes32(CROSS_CHAIN_PAY_ADDRESS));
        } else if (block.chainid == ARB_SEP) { //arb-sep
            pay.setPeer(LZ_EIDS[SEP], addressToBytes32(CROSS_CHAIN_PAY_ADDRESS));
        } else if (block.chainid == SEP) { //sep
            pay.setPeer(LZ_EIDS[ARB_SEP], addressToBytes32(CROSS_CHAIN_PAY_ADDRESS));
        }

        vm.stopBroadcast();
    }
}

