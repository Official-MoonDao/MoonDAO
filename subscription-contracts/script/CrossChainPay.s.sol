pragma solidity ^0.8.20;

import "../src/CrossChainPay.sol";
import "base/Config.sol";
import "base/Miner.sol";

contract CrossChainPayDeploy is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);
        bytes32 salt = bytes32(abi.encode(0xda0)); // ~ H(4) A(a) T(7) S(5)
        // Resolve LayerZero V2 endpoint per chain.
        address lzEndpoint;
        if (block.chainid == 1 || block.chainid == 42161 || block.chainid == 8453 || block.chainid == 10 || block.chainid == 137) {
            lzEndpoint = 0x1a44076050125825900e736c501f859c50fE728c;
        } else {
            // testnets
            lzEndpoint = 0x6EDCE65403992e310A62460808c4b910D972f10f;
        }
        CrossChainPay pay = new CrossChainPay{salt: salt}(deployer, JB_V5_MULTI_TERMINAL, address(0), lzEndpoint);
        pay.setStargateRouter(STARGATE_POOLS[block.chainid]);

        // For testing, call crossChainPay with a small amount
        if (block.chainid == OPT_SEP){
            uint256 amount = 0.001 ether;
            uint256 projectId = 146; // Example project ID
            pay.crossChainPay{value:amount*3}(LZ_EIDS[SEP], projectId, amount, deployer, 0, "", "");

        }

        vm.stopBroadcast();
    }
}

