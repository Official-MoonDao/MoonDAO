pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/governance/VotingEscrowDepositor.sol";

contract MyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        uint256 networkChainId = block.chainid;
        address MOONEY;
        address VMOONEY;
        // arbitrum
        if (networkChainId == 42161) {
            MOONEY = 0x1Fa56414549BdccBB09916f61f0A5827f779a85c;
            VMOONEY = 0xB255c74F8576f18357cE6184DA033c6d93C71899;
        } else if (networkChainId == 11155111) {
            MOONEY = 0x85A3C597F43B0cCE657793Cf31b05DF6969FbD2C;
            VMOONEY = 0xA4F6A4B135b9AF7909442A7a3bF7797b61e609b1;
        } else {
            revert("Unsupported network");
        }


        VotingEscrowDepositor sender = new VotingEscrowDepositor(MOONEY, VMOONEY);

        vm.stopBroadcast();
    }
}
