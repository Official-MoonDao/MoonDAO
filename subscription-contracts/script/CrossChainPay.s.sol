pragma solidity ^0.8.20;

import "../src/CrossChainPay.sol";
import "base/Config.sol";
import "base/Miner.sol";

contract MyScript is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);
        bytes memory constructorArgs = abi.encode(
            deployer,
            JB_MULTI_TERMINAL,
            address(0)
        );
        (address payAddress, bytes32 salt) =
            Miner.find(CREATE2_DEPLOYER, 0xda0, type(CrossChainPay).creationCode, constructorArgs);
        console.log("salt");
        console.logBytes32(salt);
        CrossChainPay pay = new CrossChainPay{salt: salt}(deployer, JB_MULTI_TERMINAL, address(0));
        pay.setStargateRouter(STARGATE_POOLS[block.chainid]);

        require(address(pay) == payAddress, "Fee hook address mismatch");
        vm.stopBroadcast();
    }
}

