
pragma solidity ^0.8.20;

import "../src/FundingOracle.sol";
import "base/Config.sol";

contract FundingOracleDeploy is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);
        bytes32 salt = bytes32(abi.encode(0xda0));
        address chainlinkRouter = CHAINLINK_ROUTERS[block.chainid];
        bytes32 donID = CHAINLINK_DONS[block.chainid];
        uint64 subscriptionId = CHAINLINK_SUBS[block.chainid];
        FundingOracle pay = new FundingOracle{salt: salt}(deployer,JB_V5_MULTI_TERMINAL, JB_V5_TERMINAL_STORE, chainlinkRouter, donID, subscriptionId);
        vm.stopBroadcast();
    }
}
