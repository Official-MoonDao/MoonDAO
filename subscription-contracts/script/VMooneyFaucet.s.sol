import "forge-std/Script.sol";
import "../src/VMooneyFaucet.sol";
import "base/Config.sol";

contract VMooneyFaucetScript is Script, Config {
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        VMooneyFaucet faucet = new VMooneyFaucet(MOONEY_ADDRESSES[block.chainid], VMOONEY_ADDRESSES[block.chainid], VOTING_ESCROW_DEPOSITOR_ADDRESSES[block.chainid]);
        vm.stopBroadcast();
    }
}

