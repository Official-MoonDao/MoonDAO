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
        CrossChainPay pay = new CrossChainPay{salt: salt}(deployer, JB_V5_MULTI_TERMINAL, address(0));
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

