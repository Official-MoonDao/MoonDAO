pragma solidity ^0.8.20;

import "../src/CrossChainPay.sol";
import "base/Config.sol";
import "base/Miner.sol";

contract CrossChainPayDeploy is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);
        // Use 0 for chain dependent stargate router address then set after to maintain
        // deterministic deploys.
        bytes memory constructorArgs = abi.encode(
            deployer,
            JB_MULTI_TERMINAL,
            address(0)
        );
        (address payAddress, bytes32 salt) =
            Miner.find(CREATE2_DEPLOYER, 0xda0, type(CrossChainPay).creationCode, constructorArgs);
        CrossChainPay pay = new CrossChainPay{salt: salt}(deployer, JB_MULTI_TERMINAL, address(0));
        pay.setStargateRouter(STARGATE_POOLS[block.chainid]);

        require(address(pay) == payAddress, "Fee hook address mismatch");

        // For testing, call crossChainPay with a small amount
        if (block.chainid == OPT_SEP){
            uint256 amount = 0.001 ether;
            uint256 projectId = 146; // Example project ID
            pay.crossChainPay{value:amount*3}(LZ_EIDS[SEP], projectId, amount, deployer, 0, "", "");

        }

        vm.stopBroadcast();
    }
}

