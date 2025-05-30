pragma solidity ^0.8.20;

import "../src/CrossChainPay.sol";
import "base/Config.sol";


contract MyScript is Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);
        CrossChainPay ccPay = CrossChainPay(CROSS_CHAIN_PAY_ADDRESS);
        uint256 amount = 0.001 ether;
        uint256 projectId = 107; // Example project ID
        //uint256 fee = ccPay.quoteCrossChainPay(LZ_EIDS[ARB_SEP], projectId, amount, deployerAddress, 0, "", "", "");
        //ccPay.crossChainPay{value:amount*2}(LZ_EIDS[OPT_SEP], projectId, amount, deployerAddress, 0, "", "", "");
        ccPay.crossChainPay{value:amount*3}(LZ_EIDS[SEP], projectId, amount, deployerAddress, 0, "", "");
        vm.stopBroadcast();
    }
}
