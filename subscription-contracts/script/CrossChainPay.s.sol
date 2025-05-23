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
            LZ_ENDPOINTS[block.chainid],
            JB_MULTI_TERMINAL);
        (address payAddress, bytes32 salt) =
            Miner.find(CREATE2_DEPLOYER, 0xda0, type(CrossChainPay).creationCode, constructorArgs);
        console.log("salt");
        console.logBytes32(salt);
        CrossChainPay pay = new CrossChainPay{salt: salt}(deployer, LZ_ENDPOINTS[block.chainid], JB_MULTI_TERMINAL);

        require(address(pay) == payAddress, "Fee hook address mismatch");
        vm.stopBroadcast();
    }
}

